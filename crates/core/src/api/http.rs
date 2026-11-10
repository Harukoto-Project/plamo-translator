//! HTTP通信の補助。

use std::time::Duration;

use serde_json::Value;

use super::connection::Connection;
use crate::error::{AppError, UrlProblem};

/// サーバーのエラーメッセージを画面に出すときの最大文字数。
const MAX_DETAIL_CHARS: usize = 300;

/// HTTPクライアントを作る。
///
/// 接続タイムアウトだけを付け、全体のタイムアウトは付けない。ストリーミングの応答や、
/// ローカルLLMの遅いプロンプト処理が数分かかることがあるため。中断は呼び出し側が行う。
pub fn build_client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::internal(format!("HTTPクライアントを初期化できませんでした: {e}")))
}

/// 通信レベルの失敗を、種別と値にする。
pub fn describe_error(connection: &Connection, error: &reqwest::Error) -> AppError {
    if error.is_builder() {
        AppError::InvalidUrl {
            reason: UrlProblem::Malformed,
        }
    } else if error.is_connect() {
        AppError::ConnectionFailed {
            url: connection.base_url.trim().to_owned(),
        }
    } else if error.is_timeout() {
        AppError::Timeout
    } else {
        AppError::Http {
            status: None,
            detail: truncate(&error.to_string()),
        }
    }
}

/// エラー応答の本文から、読みやすいメッセージを取り出す。
pub fn extract_error(body: &str) -> String {
    if let Ok(value) = serde_json::from_str::<Value>(body)
        && let Some(message) = value["error"]["message"]
            .as_str()
            .or_else(|| value["error"].as_str())
            .or_else(|| value["message"].as_str())
    {
        return truncate(message);
    }
    truncate(body.trim())
}

/// HTTPのエラー応答をエラーにする。コンテキスト長の超過は専用の種別にする。
pub fn status_error(status: reqwest::StatusCode, body: &str) -> AppError {
    let detail = extract_error(body);
    if is_context_length_error(&detail) {
        AppError::ContextLengthExceeded { detail }
    } else {
        AppError::Http {
            status: Some(status.as_u16()),
            detail,
        }
    }
}

/// ストリームの途中で届いたエラー(`{"error": ...}`)をエラーにする。
pub fn stream_error(message: &str) -> AppError {
    let detail = truncate(message);
    if is_context_length_error(&detail) {
        AppError::ContextLengthExceeded { detail }
    } else {
        AppError::Http {
            status: None,
            detail,
        }
    }
}

/// サーバーのメッセージが、コンテキスト長の超過を表しているか。
///
/// サーバーごとに文言が違う(vLLM: "maximum context length"、llama.cpp: "exceeds the available
/// context size"、LM Studio: "context length" など)ため、キーワードで見分ける。
fn is_context_length_error(message: &str) -> bool {
    let text = message.to_ascii_lowercase();
    text.contains("context length")
        || text.contains("context size")
        || text.contains("context window")
        || text.contains("context_length_exceeded")
}

fn truncate(text: &str) -> String {
    if text.is_empty() {
        String::new()
    } else if text.chars().count() > MAX_DETAIL_CHARS {
        format!(
            "{}…",
            text.chars().take(MAX_DETAIL_CHARS).collect::<String>()
        )
    } else {
        text.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use reqwest::StatusCode;

    use super::*;

    #[test]
    fn extracts_the_message_from_an_openai_error_body() {
        assert_eq!(
            extract_error(r#"{"error":{"message":"model not loaded"}}"#),
            "model not loaded"
        );
        assert_eq!(extract_error(r#"{"error":"bad"}"#), "bad");
        // vLLM の一部のエラーは、トップレベルの `message` で返る
        assert_eq!(extract_error(r#"{"message":"oops","code":400}"#), "oops");
    }

    #[test]
    fn falls_back_to_the_plain_body_and_truncates_long_ones() {
        assert_eq!(extract_error("  oops  "), "oops");
        assert_eq!(extract_error(""), "");
        let long = "あ".repeat(400);
        let text = extract_error(&long);
        assert_eq!(text.chars().count(), 301);
        assert!(text.ends_with('…'));
    }

    #[test]
    fn a_plain_http_error_keeps_the_status_and_the_server_message() {
        assert_eq!(
            status_error(StatusCode::NOT_FOUND, r#"{"error":{"message":"no model"}}"#),
            AppError::Http {
                status: Some(404),
                detail: "no model".into(),
            }
        );
    }

    #[test]
    fn context_length_errors_from_each_server_get_their_own_kind() {
        let messages = [
            // vLLM
            "This model's maximum context length is 2000 tokens. However, you requested 2500 tokens",
            // llama.cpp
            "the request exceeds the available context size, try increasing it",
            // LM Studio
            "Trying to keep the first 4000 tokens when context the overflows. However, the model is loaded with context length of only 2048 tokens",
            // OpenAI の `code`
            "context_length_exceeded",
        ];
        for message in messages {
            let body = serde_json::json!({ "error": { "message": message } }).to_string();
            assert!(
                matches!(
                    status_error(StatusCode::BAD_REQUEST, &body),
                    AppError::ContextLengthExceeded { .. }
                ),
                "{message}"
            );
        }
    }

    #[test]
    fn stream_errors_are_classified_the_same_way() {
        assert!(matches!(
            stream_error("maximum context length is 10"),
            AppError::ContextLengthExceeded { .. }
        ));
        assert_eq!(
            stream_error("boom"),
            AppError::Http {
                status: None,
                detail: "boom".into(),
            }
        );
    }
}
