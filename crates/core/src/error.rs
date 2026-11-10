//! フロントへ返すエラー。
//!
//! **種別と値だけを返し、文言は持たない。** 文言はフロントが種別のキーで引く(多言語化のため)。
//! 値にはURLやサーバーが返したメッセージなど、表示に必要なものだけを入れる。
//! APIキー・原文・訳文・リクエスト本文は含めない。

use std::fmt;

use serde::Serialize;
use specta::Type;

/// ベースURLが正しくない理由。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum UrlProblem {
    /// 空
    Empty,
    /// 空白を含む
    ContainsWhitespace,
    /// URLの形式ではない、または `http` / `https` ではない
    Malformed,
    /// ホスト名がない
    MissingHost,
    /// `?` や `#` を含む
    QueryOrFragment,
    /// ユーザー名やパスワードを含む
    Credentials,
}

/// IPCコマンドが返すエラー。`kind` で種別を区別する。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AppError {
    /// サーバーに接続できない
    ConnectionFailed { url: String },
    /// ベースURLが正しくない
    InvalidUrl { reason: UrlProblem },
    /// 応答がタイムアウトした
    Timeout,
    /// サーバーがエラーを返した。`status` は通信中のエラーなどで無いこともある。
    /// `detail` はサーバーが返したメッセージ(長いものは切り詰める)
    Http { status: Option<u16>, detail: String },
    /// 原文とプロンプトがモデルのコンテキスト長を超えた
    ContextLengthExceeded { detail: String },
    /// 応答を解釈できなかった
    InvalidResponse { detail: String },
    /// 翻訳する原文が空
    EmptyText,
    /// 最大出力トークン数が正しくない
    InvalidMaxTokens,
    /// 設定ファイルを読み込めなかった
    SettingsReadFailed { detail: String },
    /// 設定ファイルを書き込めなかった
    SettingsWriteFailed { detail: String },
    /// 設定ファイルが、このアプリより新しいバージョンで書かれている(読まず、上書きもしない)
    SettingsVersionUnsupported { version: u32 },
    /// OSの資格情報ストアを利用できない
    Secret { detail: String },
    /// 想定外の内部エラー
    Internal { detail: String },
}

impl AppError {
    pub fn internal(detail: impl Into<String>) -> Self {
        Self::Internal {
            detail: detail.into(),
        }
    }
}

impl fmt::Display for AppError {
    /// ログ・テスト用。ユーザーに見せる文言ではない(それはフロントが種別から作る)。
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{self:?}")
    }
}

impl std::error::Error for AppError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_the_kind_and_the_values_in_camel_case() {
        let json = serde_json::to_string(&AppError::ConnectionFailed {
            url: "http://x/v1".into(),
        })
        .unwrap();
        assert_eq!(json, r#"{"kind":"connectionFailed","url":"http://x/v1"}"#);
    }

    #[test]
    fn unit_variants_have_only_the_kind() {
        assert_eq!(
            serde_json::to_string(&AppError::Timeout).unwrap(),
            r#"{"kind":"timeout"}"#
        );
    }

    #[test]
    fn nested_values_are_camel_case_too() {
        let json = serde_json::to_string(&AppError::InvalidUrl {
            reason: UrlProblem::QueryOrFragment,
        })
        .unwrap();
        assert_eq!(json, r#"{"kind":"invalidUrl","reason":"queryOrFragment"}"#);
    }
}
