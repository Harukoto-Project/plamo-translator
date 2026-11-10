//! 1つのサーバーへ接続するのに必要な情報。保存の仕方には依存しない。

use std::fmt;

/// サーバーのアドレス・認証情報・モデル。
///
/// リクエストの直前に、保存済みの設定から組み立てる。APIキーはメモリ上にだけ置く。
/// `Debug` はキーを隠し、ログに紛れ込まないようにする。キーを持つ型に `Serialize` は付けない。
#[derive(Clone, PartialEq, Eq)]
pub struct Connection {
    /// APIのベースURL(例: `http://localhost:8000/v1`)
    pub base_url: String,
    /// 空でなければBearerトークンとして送る
    pub api_key: String,
    /// モデル名。空ならサーバーの既定に任せる
    pub model: String,
}

impl Connection {
    /// ベースURLの下の `path` のURL。スラッシュが重ならないようにする。
    pub fn endpoint(&self, path: &str) -> String {
        format!("{}/{}", self.base_url.trim().trim_end_matches('/'), path)
    }
}

impl fmt::Debug for Connection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Connection")
            .field("base_url", &self.base_url)
            .field("api_key", &"<hidden>")
            .field("model", &self.model)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connection(url: &str) -> Connection {
        Connection {
            base_url: url.to_owned(),
            api_key: "super-secret".to_owned(),
            model: String::new(),
        }
    }

    #[test]
    fn endpoint_joins_without_doubled_slashes() {
        assert_eq!(
            connection(" http://x/v1/ ").endpoint("completions"),
            "http://x/v1/completions"
        );
        assert_eq!(
            connection("http://x/v1").endpoint("models"),
            "http://x/v1/models"
        );
    }

    #[test]
    fn debug_output_hides_the_api_key() {
        let text = format!("{:?}", connection("http://x/v1"));
        assert!(!text.contains("super-secret"), "{text}");
        assert!(text.contains("<hidden>"), "{text}");
    }
}
