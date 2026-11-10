//! OpenAI互換サーバーのテキスト補完(`POST {base_url}/completions`)。
//! vLLM・llama.cpp・LM Studio・Ollamaなど。
//!
//! チャット(`/chat/completions`)ではなく、プロンプトをそのまま補完させる。PLaMo翻訳モデルが
//! チャット用に調整されていないため。応答は `choices[0].text` を連結する。

use std::time::Instant;

use futures_util::StreamExt;
use reqwest::{RequestBuilder, Response};
use serde_json::{Value, json};
use tokio_util::sync::CancellationToken;

use super::connection::Connection;
use super::http::{describe_error, status_error, stream_error};
use super::sse::SseLines;
use super::stats::{ReplyStats, StreamStats};
use crate::error::AppError;

/// 届いたテキストの受け取り先。`Send` が必要(非同期のまま別スレッドで実行されるため)。
pub type OnText<'a> = &'a mut (dyn FnMut(&str) + Send);

/// 補完のリクエスト。モデル名は [`Connection`] から取る。
#[derive(Debug, Clone, Copy)]
pub struct CompletionRequest<'a> {
    pub prompt: &'a str,
    pub max_tokens: u32,
    pub temperature: f32,
    /// ここに挙げた文字列が出たら生成を止める
    pub stop: &'a [&'a str],
}

/// 1回のストリームの結果。
#[derive(Debug, Default, PartialEq, Eq)]
pub struct StreamOutcome {
    /// 呼び出し側の中断で終わった
    pub cancelled: bool,
    /// 最大出力トークン数に達して止まった(出力が途中で切れている)
    pub truncated: bool,
    /// 出力速度。出力が無い・時間が短すぎるときは `None`
    pub stats: Option<ReplyStats>,
}

/// 補完を生成し、テキストが届くたびに `on_text` を呼ぶ。
///
/// 中断されたら、そこまでの結果で `Ok` を返す。失敗は `Err`。
pub async fn stream(
    client: &reqwest::Client,
    connection: &Connection,
    request: CompletionRequest<'_>,
    cancel: &CancellationToken,
    on_text: OnText<'_>,
) -> Result<StreamOutcome, AppError> {
    let builder = authorized(client.post(connection.endpoint("completions")), connection)
        .json(&request_body(&connection.model, request));

    // 応答の先頭が届くまでにも時間がかかる(プロンプト処理など)ため、ここも中断できるようにする
    let Some(sent) = cancel.run_until_cancelled(builder.send()).await else {
        return Ok(cancelled());
    };
    let response = sent.map_err(|e| describe_error(connection, &e))?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(status_error(status, &text));
    }

    if is_json(&response) {
        // `stream: true` を無視して、通常のJSONで返すサーバーがある
        read_plain_reply(response, cancel, on_text).await
    } else {
        read_event_stream(response, cancel, on_text).await
    }
}

fn cancelled() -> StreamOutcome {
    StreamOutcome {
        cancelled: true,
        ..StreamOutcome::default()
    }
}

/// APIキーが設定されていれば、Bearerトークンとして付ける。
fn authorized(request: RequestBuilder, connection: &Connection) -> RequestBuilder {
    match connection.api_key.trim() {
        "" => request,
        key => request.bearer_auth(key),
    }
}

fn request_body(model: &str, request: CompletionRequest<'_>) -> Value {
    let mut body = json!({
        "prompt": request.prompt,
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "stop": request.stop,
        "stream": true,
        // 出力速度(tokens/s)のために、最後にトークン数を返してもらう
        "stream_options": { "include_usage": true },
    });
    let model = model.trim();
    if !model.is_empty() {
        body["model"] = json!(model);
    }
    body
}

fn is_json(response: &Response) -> bool {
    response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.contains("application/json"))
}

async fn read_plain_reply(
    response: Response,
    cancel: &CancellationToken,
    on_text: OnText<'_>,
) -> Result<StreamOutcome, AppError> {
    let Some(parsed) = cancel.run_until_cancelled(response.json::<Value>()).await else {
        return Ok(cancelled());
    };
    let value = parsed.map_err(|e| AppError::InvalidResponse {
        detail: e.to_string(),
    })?;
    if let Some(message) = error_message(&value) {
        return Err(stream_error(&message));
    }
    if let Some(text) = text_of(&value) {
        on_text(text);
    }
    Ok(StreamOutcome {
        truncated: is_truncated(&value),
        ..StreamOutcome::default()
    })
}

/// `[DONE]`、ストリームの終わり、または中断までSSEを読む。
async fn read_event_stream(
    response: Response,
    cancel: &CancellationToken,
    on_text: OnText<'_>,
) -> Result<StreamOutcome, AppError> {
    let mut stream = response.bytes_stream();
    let mut lines = SseLines::new();
    let mut state = StreamState::default();
    let mut was_cancelled = false;

    'read: loop {
        let Some(next) = cancel.run_until_cancelled(stream.next()).await else {
            was_cancelled = true;
            break;
        };
        let Some(chunk) = next else {
            // ストリームの終端。改行で終わらなかった最後の行を処理する
            if let Some(data) = lines.finish() {
                state.handle(&data, on_text)?;
            }
            break;
        };
        let bytes = chunk.map_err(|e| AppError::Http {
            status: None,
            detail: e.to_string(),
        })?;
        for data in lines.push(&bytes) {
            if state.handle(&data, on_text)? {
                break 'read;
            }
        }
    }

    Ok(StreamOutcome {
        cancelled: was_cancelled,
        truncated: state.truncated,
        stats: state.stats.finish(),
    })
}

/// ストリームを読むあいだ溜めていく状態。
#[derive(Debug, Default)]
struct StreamState {
    stats: StreamStats,
    truncated: bool,
}

impl StreamState {
    /// `data:` 行1件を処理する。`[DONE]` なら `true`。
    fn handle(&mut self, data: &str, on_text: OnText<'_>) -> Result<bool, AppError> {
        if data == "[DONE]" {
            return Ok(true);
        }
        // 解釈できない行(キープアライブなど)は読み飛ばす
        let Ok(value) = serde_json::from_str::<Value>(data) else {
            return Ok(false);
        };
        if let Some(message) = error_message(&value) {
            return Err(stream_error(&message));
        }
        // `stream_options.include_usage` を付けると、最後に `choices` が空で `usage` だけのデータが届く
        if let Some(tokens) = value["usage"]["completion_tokens"].as_u64() {
            self.stats.record_usage(tokens);
        }
        if is_truncated(&value) {
            self.truncated = true;
        }
        if let Some(text) = text_of(&value) {
            self.stats.record_output(Instant::now());
            on_text(text);
        }
        Ok(false)
    }
}

fn error_message(value: &Value) -> Option<String> {
    let error = value.get("error")?;
    Some(
        error["message"]
            .as_str()
            .or_else(|| error.as_str())
            .unwrap_or_default()
            .to_owned(),
    )
}

/// 生成されたテキスト。空なら `None`。
fn text_of(value: &Value) -> Option<&str> {
    value["choices"][0]["text"]
        .as_str()
        .filter(|t| !t.is_empty())
}

/// 最大出力トークン数に達して止まったか。
fn is_truncated(value: &Value) -> bool {
    value["choices"][0]["finish_reason"].as_str() == Some("length")
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;
    use crate::api::test_support::{json_response, serve_hanging, serve_once};
    use crate::error::AppError;

    fn connection(base_url: &str) -> Connection {
        Connection {
            base_url: base_url.to_owned(),
            api_key: String::new(),
            model: "pfnet/plamo-2-translate".to_owned(),
        }
    }

    const REQUEST: CompletionRequest<'static> = CompletionRequest {
        prompt: "PROMPT",
        max_tokens: 64,
        temperature: 0.0,
        stop: &["<|plamo:op|>"],
    };

    /// `stream` を実行して、届いたテキストと結果を返す。
    async fn run(
        connection: &Connection,
        cancel: &CancellationToken,
    ) -> (String, Result<StreamOutcome, AppError>) {
        let client = crate::api::http::build_client().unwrap();
        let mut text = String::new();
        let result = stream(&client, connection, REQUEST, cancel, &mut |t| {
            text.push_str(t);
        })
        .await;
        (text, result)
    }

    fn sse(body: &str) -> String {
        format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n{body}"
        )
    }

    fn chunk(text: &str) -> String {
        format!(
            "data: {}\n\n",
            json!({ "choices": [{ "text": text, "finish_reason": null }] })
        )
    }

    #[test]
    fn the_request_body_is_a_raw_completion_with_the_stop_token() {
        let body = request_body(" model ", REQUEST);

        assert_eq!(body["prompt"], "PROMPT");
        assert_eq!(body["model"], "model");
        assert_eq!(body["temperature"], 0.0);
        assert_eq!(body["max_tokens"], 64);
        assert_eq!(body["stop"], json!(["<|plamo:op|>"]));
        assert_eq!(body["stream"], true);
        assert!(body.get("messages").is_none());
    }

    #[test]
    fn a_blank_model_is_left_out_of_the_body() {
        assert!(request_body("  ", REQUEST).get("model").is_none());
    }

    #[tokio::test]
    async fn joins_the_text_of_the_event_stream_and_stops_at_done() {
        let body = format!(
            "{}{}{}data: [DONE]\n\n{}",
            chunk("Hello"),
            chunk(", "),
            chunk("world"),
            // [DONE] より後ろは読まない
            chunk("IGNORED"),
        );
        let (url, server) = serve_once(sse(&body));

        let (text, result) = run(&connection(&url), &CancellationToken::new()).await;

        assert_eq!(text, "Hello, world");
        let outcome = result.unwrap();
        assert!(!outcome.cancelled);
        assert!(!outcome.truncated);
        let request = server.join().unwrap();
        assert!(request.starts_with("POST /v1/completions "), "{request}");
        assert!(request.contains("PROMPT"), "{request}");
    }

    #[tokio::test]
    async fn sends_the_api_key_as_a_bearer_token_only_when_set() {
        let (url, server) = serve_once(sse("data: [DONE]\n\n"));
        let mut conn = connection(&url);
        conn.api_key = " sk-test ".to_owned();
        run(&conn, &CancellationToken::new()).await.1.unwrap();
        let with_key = server.join().unwrap().to_ascii_lowercase();
        assert!(
            with_key.contains("authorization: bearer sk-test"),
            "{with_key}"
        );

        let (url, server) = serve_once(sse("data: [DONE]\n\n"));
        run(&connection(&url), &CancellationToken::new())
            .await
            .1
            .unwrap();
        let without_key = server.join().unwrap().to_ascii_lowercase();
        assert!(!without_key.contains("authorization"), "{without_key}");
    }

    #[tokio::test]
    async fn the_last_line_without_a_newline_is_still_read() {
        let body = format!(
            "{}data: {}",
            chunk("a"),
            json!({ "choices": [{ "text": "b" }] })
        );
        let (url, _server) = serve_once(sse(&body));

        let (text, result) = run(&connection(&url), &CancellationToken::new()).await;

        assert_eq!(text, "ab");
        result.unwrap();
    }

    #[tokio::test]
    async fn reads_a_plain_json_reply_when_the_server_ignores_stream() {
        let body = json!({
            "choices": [{ "text": "こんにちは", "finish_reason": "stop" }]
        })
        .to_string();
        let (url, _server) = serve_once(json_response("200 OK", &body));

        let (text, result) = run(&connection(&url), &CancellationToken::new()).await;

        assert_eq!(text, "こんにちは");
        assert_eq!(result.unwrap(), StreamOutcome::default());
    }

    #[tokio::test]
    async fn a_length_finish_reason_marks_the_outcome_as_truncated() {
        let body = format!(
            "data: {}\n\ndata: [DONE]\n\n",
            json!({ "choices": [{ "text": "abc", "finish_reason": "length" }] })
        );
        let (url, _server) = serve_once(sse(&body));

        let (text, result) = run(&connection(&url), &CancellationToken::new()).await;

        assert_eq!(text, "abc");
        assert!(result.unwrap().truncated);
    }

    #[tokio::test]
    async fn skips_lines_that_are_not_json() {
        let body = format!(
            ": keep-alive\n\ndata: not json\n\n{}data: [DONE]\n\n",
            chunk("ok")
        );
        let (url, _server) = serve_once(sse(&body));

        let (text, result) = run(&connection(&url), &CancellationToken::new()).await;

        assert_eq!(text, "ok");
        result.unwrap();
    }

    #[tokio::test]
    async fn an_http_error_carries_the_status_and_the_server_message() {
        let body = json!({ "error": { "message": "model not found" } }).to_string();
        let (url, _server) = serve_once(json_response("404 Not Found", &body));

        let (text, result) = run(&connection(&url), &CancellationToken::new()).await;

        assert_eq!(text, "");
        assert_eq!(
            result.unwrap_err(),
            AppError::Http {
                status: Some(404),
                detail: "model not found".into(),
            }
        );
    }

    #[tokio::test]
    async fn a_context_length_error_has_its_own_kind() {
        let body = json!({
            "error": { "message": "This model's maximum context length is 2000 tokens." }
        })
        .to_string();
        let (url, _server) = serve_once(json_response("400 Bad Request", &body));

        let (_, result) = run(&connection(&url), &CancellationToken::new()).await;

        assert!(matches!(
            result.unwrap_err(),
            AppError::ContextLengthExceeded { .. }
        ));
    }

    #[tokio::test]
    async fn an_error_in_the_middle_of_the_stream_is_reported_after_the_text_so_far() {
        let body = format!(
            "{}data: {}\n\n",
            chunk("partial"),
            json!({ "error": { "message": "out of memory" } })
        );
        let (url, _server) = serve_once(sse(&body));

        let (text, result) = run(&connection(&url), &CancellationToken::new()).await;

        assert_eq!(text, "partial");
        assert_eq!(
            result.unwrap_err(),
            AppError::Http {
                status: None,
                detail: "out of memory".into(),
            }
        );
    }

    #[tokio::test]
    async fn a_closed_port_is_a_connection_failure_with_the_url() {
        let (_, result) = run(
            &connection("http://127.0.0.1:1/v1"),
            &CancellationToken::new(),
        )
        .await;

        assert_eq!(
            result.unwrap_err(),
            AppError::ConnectionFailed {
                url: "http://127.0.0.1:1/v1".into(),
            }
        );
    }

    #[tokio::test]
    async fn cancelling_mid_stream_keeps_the_text_so_far_and_returns_ok() {
        let (url, server) = serve_hanging(sse(&chunk("first")));
        let cancel = CancellationToken::new();
        let trigger = cancel.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(300)).await;
            trigger.cancel();
        });

        let (text, result) = run(&connection(&url), &cancel).await;

        assert_eq!(text, "first");
        assert!(result.unwrap().cancelled);
        server.join().unwrap();
    }

    #[tokio::test]
    async fn cancelling_before_the_response_arrives_returns_ok() {
        // 接続は受け付けるが、何も返さないサーバー
        let (url, server) = serve_hanging(String::new());
        let cancel = CancellationToken::new();
        let trigger = cancel.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(300)).await;
            trigger.cancel();
        });

        let (text, result) = run(&connection(&url), &cancel).await;

        assert_eq!(text, "");
        assert!(result.unwrap().cancelled);
        server.join().unwrap();
    }
}
