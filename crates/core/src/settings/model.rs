//! 設定の型。

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::api::Connection;
use crate::error::AppError;
use crate::profiles::ProfileBook;

/// 接続先のURLの初期値。vLLM(PLaMo公式の動かし方)に合わせる。
pub const DEFAULT_BASE_URL: &str = "http://localhost:8000/v1";
/// モデル名の初期値。
pub const DEFAULT_MODEL: &str = "pfnet/plamo-2-translate";
/// 最大出力トークン数の初期値。
pub const DEFAULT_MAX_TOKENS: u32 = 1024;
/// 最大出力トークン数の上限(桁違いの入力の防止)。
pub const MAX_MAX_TOKENS: u32 = 1_000_000;
/// 1ブロックに入れる原文の文字数の初期値。
pub const DEFAULT_CHUNK_BUDGET: u32 = 1500;
/// 分割の文字数の上限(桁違いの入力の防止)。
pub const MAX_CHUNK_BUDGET: u32 = 1_000_000;

fn default_chunk_budget() -> u32 {
    DEFAULT_CHUNK_BUDGET
}

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

/// 生成の設定。接続先には属さない。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct GenerationSettings {
    /// 1回の翻訳で出力するトークン数の上限
    pub max_tokens: u32,
    /// 1ブロックに入れる原文の文字数。長い原文は、この文字数以内の塊に分けて順に翻訳する。
    #[serde(default = "default_chunk_budget")]
    pub chunk_budget: u32,
}

impl Default for GenerationSettings {
    fn default() -> Self {
        Self {
            max_tokens: DEFAULT_MAX_TOKENS,
            chunk_budget: DEFAULT_CHUNK_BUDGET,
        }
    }
}

/// 保存する設定のすべて。
///
/// `connection` は、使用中プロファイルのURLとモデルを書き戻した複製。
/// 接続先の正は `profiles`。`connection` の名前と型は、以前の保存と読み手のために残す。
/// 分割の文字数は `generation` にあり、プロファイルごとには持たない。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub connection: ConnectionSettings,
    pub generation: GenerationSettings,
    pub profiles: ProfileBook,
}

impl Settings {
    /// 使用中プロファイルのURLとモデルを `connection` に写す。
    pub fn sync_connection(&mut self) {
        if let Some(active) = self.profiles.active() {
            self.connection.base_url.clone_from(&active.base_url);
            self.connection.model.clone_from(&active.model);
        }
    }

    /// 検査して、保存する形にする。
    ///
    /// プロファイルのURL・名前を整え、`connection` は使用中プロファイルから作り直す。
    pub fn validated(mut self) -> Result<Self, AppError> {
        self.profiles = self.profiles.validated()?;
        self.sync_connection();
        if !(1..=MAX_MAX_TOKENS).contains(&self.generation.max_tokens) {
            return Err(AppError::InvalidMaxTokens);
        }
        if !(1..=MAX_CHUNK_BUDGET).contains(&self.generation.chunk_budget) {
            return Err(AppError::InvalidChunkBudget);
        }
        Ok(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::UrlProblem;

    fn with_active(
        mut profile_edit: impl FnMut(&mut crate::profiles::ConnectionProfile),
    ) -> Settings {
        let mut settings = Settings::default();
        profile_edit(&mut settings.profiles.profiles[0]);
        settings
    }

    #[test]
    fn the_defaults_are_valid_and_point_at_vllm() {
        let settings = Settings::default().validated().unwrap();

        assert_eq!(settings.connection.base_url, "http://localhost:8000/v1");
        assert_eq!(settings.connection.model, "pfnet/plamo-2-translate");
        assert_eq!(settings.generation.max_tokens, 1024);
        assert_eq!(settings.generation.chunk_budget, DEFAULT_CHUNK_BUDGET);
        assert_eq!(settings.profiles.active().unwrap().id, "default");
    }

    #[test]
    fn validation_normalizes_the_active_profile_into_connection() {
        let settings = with_active(|profile| {
            profile.base_url = " http://localhost:1234/v1/ ".into();
            profile.model = "  m  ".into();
        })
        .validated()
        .unwrap();

        assert_eq!(
            settings.profiles.active().unwrap().base_url,
            "http://localhost:1234/v1"
        );
        assert_eq!(settings.connection.base_url, "http://localhost:1234/v1");
        assert_eq!(settings.connection.model, "m");
    }

    #[test]
    fn a_blank_model_is_allowed() {
        let settings = with_active(|profile| profile.model = "   ".into())
            .validated()
            .unwrap();

        assert_eq!(settings.connection.model, "");
    }

    #[test]
    fn a_bad_url_is_rejected_with_the_reason() {
        let result = with_active(|profile| profile.base_url = "localhost".into()).validated();

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
                generation: GenerationSettings {
                    max_tokens,
                    ..GenerationSettings::default()
                },
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
        assert_eq!(settings.generation.chunk_budget, DEFAULT_CHUNK_BUDGET);
    }

    #[test]
    fn chunk_budget_must_be_between_one_and_the_limit() {
        let with = |chunk_budget| {
            Settings {
                generation: GenerationSettings {
                    chunk_budget,
                    ..GenerationSettings::default()
                },
                ..Settings::default()
            }
            .validated()
        };

        assert_eq!(with(0).unwrap_err(), AppError::InvalidChunkBudget);
        assert_eq!(
            with(MAX_CHUNK_BUDGET + 1).unwrap_err(),
            AppError::InvalidChunkBudget
        );
        assert!(with(1).is_ok());
        assert!(with(MAX_CHUNK_BUDGET).is_ok());
    }

    #[test]
    fn builds_a_connection_with_the_key() {
        let connection = ConnectionSettings::default().connection("k".into());

        assert_eq!(connection.base_url, DEFAULT_BASE_URL);
        assert_eq!(connection.api_key, "k");
        assert_eq!(connection.model, DEFAULT_MODEL);
    }
}
