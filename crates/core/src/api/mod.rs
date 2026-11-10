//! PLaMo翻訳モデルを動かすサーバーへのAPI呼び出し。
//!
//! 設定の保存先は知らない。呼び出し側が [`Connection`] を組み立てて渡す。
//! 通信は1種類(`POST {base_url}/completions`)。ProviderのトレイトやAnthropic対応は持たない。

mod active;
mod completions;
mod connection;
mod http;
mod sse;
mod stats;
#[cfg(test)]
pub(crate) mod test_support;

pub use active::{ActiveGuard, ActiveRequests};
pub use completions::{CompletionRequest, OnText, StreamOutcome};
pub use connection::Connection;
pub use stats::ReplyStats;

use crate::error::AppError;

/// HTTPクライアントと、実行中のリクエストをまとめたもの。アプリで1つ作って共有する。
pub struct ApiClient {
    http: reqwest::Client,
    active: ActiveRequests,
}

impl ApiClient {
    pub fn new() -> Result<Self, AppError> {
        Ok(Self {
            http: http::build_client()?,
            active: ActiveRequests::default(),
        })
    }

    /// テキスト補完を生成し、テキストが届くたびに `on_text` を呼ぶ。
    ///
    /// `request_id` で [`cancel`](Self::cancel) できる。中断されたら、そこまでの結果で `Ok` を返す。
    pub async fn stream_completion(
        &self,
        request_id: &str,
        connection: &Connection,
        request: CompletionRequest<'_>,
        on_text: OnText<'_>,
    ) -> Result<StreamOutcome, AppError> {
        let guard = self.active.register(request_id);
        completions::stream(&self.http, connection, request, guard.token(), on_text).await
    }

    /// 実行中のリクエストを中断する。実行中のものがあれば `true`。
    pub fn cancel(&self, request_id: &str) -> bool {
        self.active.cancel(request_id)
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::serve_once;
    use super::*;

    fn connection(base_url: &str) -> Connection {
        Connection {
            base_url: base_url.to_owned(),
            api_key: String::new(),
            model: String::new(),
        }
    }

    const REQUEST: CompletionRequest<'static> = CompletionRequest {
        prompt: "p",
        max_tokens: 8,
        temperature: 0.0,
        stop: &[],
    };

    #[tokio::test]
    async fn streams_through_the_client_and_unregisters_the_request_afterwards() {
        let (url, _server) = serve_once(
            "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n\
             data: {\"choices\":[{\"text\":\"hi\"}]}\n\ndata: [DONE]\n\n"
                .to_owned(),
        );
        let api = ApiClient::new().unwrap();
        let mut text = String::new();

        let outcome = api
            .stream_completion("r1", &connection(&url), REQUEST, &mut |t| text.push_str(t))
            .await
            .unwrap();

        assert_eq!(text, "hi");
        assert!(!outcome.cancelled);
        // 終わったリクエストは、もう中断の対象ではない
        assert!(!api.cancel("r1"));
    }

    #[test]
    fn cancelling_an_unknown_request_is_harmless() {
        assert!(!ApiClient::new().unwrap().cancel("nope"));
    }
}
