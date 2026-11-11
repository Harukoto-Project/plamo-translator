//! `GET {base_url}/models`。OpenAI互換の `{ "data": [{ "id": "..." }] }` だけを読む。
//!
//! サーバーごとの別形式(Ollamaの `/api/tags` など)は見ない。取れなければ呼び出し側が
//! 手入力に戻す。

use serde_json::Value;

use super::connection::Connection;
use super::http::{authorized, describe_error, status_error};
use crate::error::AppError;

/// モデルIDの一覧(昇順、重複なし)。`data` が無ければ空。
pub async fn list_models(
    client: &reqwest::Client,
    connection: &Connection,
) -> Result<Vec<String>, AppError> {
    let request = authorized(client.get(connection.endpoint("models")), connection);
    let response = request
        .send()
        .await
        .map_err(|error| describe_error(connection, &error))?;
    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(status_error(status, &text));
    }
    let value: Value = response
        .json()
        .await
        .map_err(|error| AppError::InvalidResponse {
            detail: truncate_parse(&error.to_string()),
        })?;
    Ok(parse_models(&value))
}

fn parse_models(value: &Value) -> Vec<String> {
    let mut models: Vec<String> = value["data"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    item["id"]
                        .as_str()
                        .map(str::trim)
                        .filter(|id| !id.is_empty())
                        .map(str::to_owned)
                })
                .collect()
        })
        .unwrap_or_default();
    models.sort();
    models.dedup();
    models
}

/// 解析エラーはサーバーのメッセージと同じくらいに切る(キーや本文はここには来ない)。
fn truncate_parse(text: &str) -> String {
    const MAX: usize = 300;
    if text.chars().count() > MAX {
        format!("{}…", text.chars().take(MAX).collect::<String>())
    } else {
        text.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{json_response, serve_once};
    use super::*;

    fn connection(base_url: &str, api_key: &str) -> Connection {
        Connection {
            base_url: base_url.to_owned(),
            api_key: api_key.to_owned(),
            model: String::new(),
        }
    }

    #[test]
    fn models_are_sorted_deduped_and_blank_ids_are_dropped() {
        let value = serde_json::json!({
            "data": [
                {"id": "zeta"},
                {"id": " alpha "},
                {"id": "alpha"},
                {"id": "  "},
                {"id": 1}
            ]
        });
        assert_eq!(parse_models(&value), ["alpha", "zeta"]);
        assert!(parse_models(&serde_json::json!({})).is_empty());
        assert!(parse_models(&serde_json::json!({"models": ["a"]})).is_empty());
    }

    #[tokio::test]
    async fn lists_models_with_a_bearer_token_when_a_key_is_set() {
        let (url, server) = serve_once(json_response(
            "200 OK",
            r#"{"data":[{"id":"zeta"},{"id":"alpha"}]}"#,
        ));
        let client = reqwest::Client::new();

        let models = list_models(&client, &connection(&url, "test-key"))
            .await
            .unwrap();

        assert_eq!(models, ["alpha", "zeta"]);
        let request = server.join().unwrap();
        let lower = request.to_ascii_lowercase();
        assert!(lower.starts_with("get /v1/models"), "{request}");
        assert!(
            lower.contains("authorization: bearer test-key"),
            "{request}"
        );
    }

    #[tokio::test]
    async fn an_http_error_keeps_the_status_and_the_server_message() {
        let (url, _server) = serve_once(json_response(
            "404 Not Found",
            r#"{"error":{"message":"no model"}}"#,
        ));
        let client = reqwest::Client::new();

        let error = list_models(&client, &connection(&url, ""))
            .await
            .unwrap_err();

        assert_eq!(
            error,
            AppError::Http {
                status: Some(404),
                detail: "no model".into(),
            }
        );
    }
}
