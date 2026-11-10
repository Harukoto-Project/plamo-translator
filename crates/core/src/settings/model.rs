//! 設定の型。

use serde::{Deserialize, Serialize};
use specta::Type;

use super::url::validate_base_url;
use crate::api::Connection;
use crate::error::AppError;

/// 接続先のURLの初期値。vLLM(PLaMo公式の動かし方)に合わせる。
pub const DEFAULT_BASE_URL: &str = "http://localhost:8000/v1";
/// モデル名の初期値。
pub const DEFAULT_MODEL: &str = "pfnet/plamo-2-translate";
/// 最大出力トークン数の初期値。
pub const DEFAULT_MAX_TOKENS: u32 = 1024;
/// 最大出力トークン数の上限(桁違いの入力の防止)。
pub const MAX_MAX_TOKENS: u32 = 1_000_000;

/// 接続先。APIキーは含まない(OSの資格情報ストアにある)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ConnectionSettings {
    /// APIのベースURL(例: `http://localhost:8000/v1`)
    pub base_url: String,
    /// モデル名。空ならサーバーの既定に任せる
    pub model: String,
}

impl Default for ConnectionSettings {
    fn default() -> Self {
        Self {
            base_url: DEFAULT_BASE_URL.to_owned(),
            model: DEFAULT_MODEL.to_owned(),
        }
    }
}

impl ConnectionSettings {
    /// APIキーを加えて、通信に使う [`Connection`] にする。
    pub fn connection(&self, api_key: String) -> Connection {
        Connection {
            base_url: self.base_url.clone(),
            api_key,
            model: self.model.clone(),
        }
    }
}

/// 生成の設定。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct GenerationSettings {
    /// 1回の翻訳で出力するトークン数の上限
    pub max_tokens: u32,
}

impl Default for GenerationSettings {
    fn default() -> Self {
        Self {
            max_tokens: DEFAULT_MAX_TOKENS,
        }
    }
}

/// 保存する設定のすべて。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub connection: ConnectionSettings,
    pub generation: GenerationSettings,
}

impl Settings {
    /// 検査して、保存する形(URLの空白や末尾のスラッシュを除いたもの)にする。
    pub fn validated(mut self) -> Result<Self, AppError> {
        self.connection.base_url = validate_base_url(&self.connection.base_url)?;
        self.connection.model = self.connection.model.trim().to_owned();
        if !(1..=MAX_MAX_TOKENS).contains(&self.generation.max_tokens) {
            return Err(AppError::InvalidMaxTokens);
        }
        Ok(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::UrlProblem;

    #[test]
    fn the_defaults_are_valid_and_point_at_vllm() {
        let settings = Settings::default().validated().unwrap();

        assert_eq!(settings.connection.base_url, "http://localhost:8000/v1");
        assert_eq!(settings.connection.model, "pfnet/plamo-2-translate");
        assert_eq!(settings.generation.max_tokens, 1024);
    }

    #[test]
    fn validation_normalizes_the_url_and_the_model() {
        let settings = Settings {
            connection: ConnectionSettings {
                base_url: " http://localhost:1234/v1/ ".into(),
                model: "  m  ".into(),
            },
            ..Settings::default()
        }
        .validated()
        .unwrap();

        assert_eq!(settings.connection.base_url, "http://localhost:1234/v1");
        assert_eq!(settings.connection.model, "m");
    }

    #[test]
    fn a_blank_model_is_allowed() {
        let settings = Settings {
            connection: ConnectionSettings {
                model: "   ".into(),
                ..ConnectionSettings::default()
            },
            ..Settings::default()
        }
        .validated()
        .unwrap();

        assert_eq!(settings.connection.model, "");
    }

    #[test]
    fn a_bad_url_is_rejected_with_the_reason() {
        let result = Settings {
            connection: ConnectionSettings {
                base_url: "localhost".into(),
                ..ConnectionSettings::default()
            },
            ..Settings::default()
        }
        .validated();

        assert_eq!(
            result.unwrap_err(),
            AppError::InvalidUrl {
                reason: UrlProblem::Malformed
            }
        );
    }

    #[test]
    fn max_tokens_must_be_between_one_and_the_limit() {
        let with = |max_tokens| {
            Settings {
                generation: GenerationSettings { max_tokens },
                ..Settings::default()
            }
            .validated()
        };

        assert_eq!(with(0).unwrap_err(), AppError::InvalidMaxTokens);
        assert_eq!(
            with(MAX_MAX_TOKENS + 1).unwrap_err(),
            AppError::InvalidMaxTokens
        );
        assert!(with(1).is_ok());
        assert!(with(MAX_MAX_TOKENS).is_ok());
    }

    #[test]
    fn missing_fields_fall_back_to_the_defaults() {
        let settings: Settings = serde_json::from_str(r#"{"connection":{"model":"x"}}"#).unwrap();

        assert_eq!(settings.connection.model, "x");
        assert_eq!(settings.connection.base_url, DEFAULT_BASE_URL);
        assert_eq!(settings.generation, GenerationSettings::default());
    }

    #[test]
    fn builds_a_connection_with_the_key() {
        let connection = ConnectionSettings::default().connection("k".into());

        assert_eq!(connection.base_url, DEFAULT_BASE_URL);
        assert_eq!(connection.api_key, "k");
        assert_eq!(connection.model, DEFAULT_MODEL);
    }
}
