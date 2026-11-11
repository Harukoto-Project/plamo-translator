//! 保存された接続先1件。

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::api::Connection;
use crate::error::{AppError, NameProblem};
use crate::settings::validate_base_url;

/// いまの単一の接続先を引き継ぐプロファイルのID。
///
/// APIキーのアカウント名は、以前から `profile:default:api_key` なので、
/// 移行した接続先のIDをこれに揃えると、保存済みのキーをそのまま使える。
pub const DEFAULT_PROFILE_ID: &str = "default";

/// 名前の最大文字数。
pub const MAX_NAME_CHARS: usize = 60;

/// 名前を付けたサーバー。
///
/// APIキーはフィールドに持たない。OSの資格情報ストアに、`id` から決まるアカウント名で保存する
/// (→ [`crate::profiles::ProfileKeys`])。プロファイルをシリアライズしてもキーは書き出されない。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    /// 名前を変えても変わらない。キーなどがこのIDを参照する
    pub id: String,
    pub name: String,
    /// APIのベースURL(例: `http://localhost:8000/v1`)
    pub base_url: String,
    /// このサーバーで使うモデル。空ならサーバーの既定に任せる
    pub model: String,
}

impl ConnectionProfile {
    /// 入力を検査し、保存する形に整える(名前・モデル名の空白を除き、URLを正規化する)。
    pub fn validated(&self) -> Result<Self, AppError> {
        let name = self.name.trim();
        if name.is_empty() {
            return Err(AppError::InvalidProfileName {
                reason: NameProblem::Empty,
            });
        }
        if name.chars().count() > MAX_NAME_CHARS {
            return Err(AppError::InvalidProfileName {
                reason: NameProblem::TooLong,
            });
        }
        Ok(Self {
            id: self.id.clone(),
            name: name.to_owned(),
            base_url: validate_base_url(&self.base_url)?,
            model: self.model.trim().to_owned(),
        })
    }

    /// リクエストに必要な接続情報。APIキーはメモリ上にだけ持つ。
    pub fn connection(&self, api_key: &str) -> Connection {
        Connection {
            base_url: self.base_url.clone(),
            api_key: api_key.to_owned(),
            model: self.model.clone(),
        }
    }
}

/// IDとして使える文字列か(ASCIIの英数字・`-`・`_`、1〜64文字)。
pub fn is_valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::UrlProblem;

    fn profile() -> ConnectionProfile {
        ConnectionProfile {
            id: "a".into(),
            name: "A".into(),
            base_url: "http://a/v1".into(),
            model: String::new(),
        }
    }

    #[test]
    fn validation_trims_and_normalizes() {
        let input = ConnectionProfile {
            name: "  自宅 ".into(),
            base_url: " http://a/v1/ ".into(),
            model: "  llama ".into(),
            ..profile()
        };

        let output = input.validated().unwrap();

        assert_eq!(output.name, "自宅");
        assert_eq!(output.base_url, "http://a/v1");
        assert_eq!(output.model, "llama");
    }

    #[test]
    fn a_blank_model_is_kept_as_empty() {
        let input = ConnectionProfile {
            model: "   ".into(),
            ..profile()
        };
        assert_eq!(input.validated().unwrap().model, "");
    }

    #[test]
    fn blank_and_too_long_names_are_rejected() {
        let blank = ConnectionProfile {
            name: "  ".into(),
            ..profile()
        };
        assert_eq!(
            blank.validated().unwrap_err(),
            AppError::InvalidProfileName {
                reason: NameProblem::Empty
            }
        );
        let long = ConnectionProfile {
            name: "あ".repeat(MAX_NAME_CHARS + 1),
            ..profile()
        };
        assert_eq!(
            long.validated().unwrap_err(),
            AppError::InvalidProfileName {
                reason: NameProblem::TooLong
            }
        );
    }

    #[test]
    fn an_invalid_url_is_rejected() {
        let input = ConnectionProfile {
            base_url: "localhost".into(),
            ..profile()
        };
        assert_eq!(
            input.validated().unwrap_err(),
            AppError::InvalidUrl {
                reason: UrlProblem::Malformed
            }
        );
    }

    #[test]
    fn connection_carries_url_key_and_model() {
        let profile = ConnectionProfile {
            model: "pfnet/plamo-2-translate".into(),
            ..profile()
        };

        let connection = profile.connection("k");

        assert_eq!(connection.base_url, "http://a/v1");
        assert_eq!(connection.api_key, "k");
        assert_eq!(connection.model, "pfnet/plamo-2-translate");
    }

    #[test]
    fn a_serialized_profile_has_no_key_field() {
        let text = serde_json::to_string(&profile()).unwrap();
        assert!(!text.to_ascii_lowercase().contains("key"), "{text}");
    }

    #[test]
    fn ids_allow_only_ascii_alphanumerics_hyphen_and_underscore() {
        assert!(is_valid_id("default"));
        assert!(is_valid_id("a-B_9"));
        assert!(!is_valid_id(""));
        assert!(!is_valid_id("a b"));
        assert!(!is_valid_id("../x"));
        assert!(!is_valid_id("日本語"));
        assert!(!is_valid_id(&"a".repeat(65)));
    }
}
