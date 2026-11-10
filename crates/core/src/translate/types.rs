//! 翻訳のIPCで使う型。

use serde::{Deserialize, Serialize};
use specta::Type;

use super::lang::Lang;
use crate::api::ReplyStats;
use crate::error::AppError;

/// 翻訳のリクエスト。接続先とモデルは保存済みの設定から読む。
#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TranslateRequest {
    /// フロントが発行するUUID。中断の対象を指す
    pub request_id: String,
    /// `auto` は画面で解決してから渡す
    pub source_lang: Lang,
    pub target_lang: Lang,
    /// 原文
    pub text: String,
}

/// 画面に出す警告。翻訳は続行している。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TranslateWarning {
    /// 原文に含まれていたプロンプトの区切り文字を取り除いた
    DelimiterRemoved,
    /// 最大出力トークン数に達したため、訳文が途中で切れている
    OutputTruncated,
}

/// 翻訳の進行を伝えるイベント。終わりには必ず `Done` か `Error` のどちらかを1回流す。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TranslateEvent {
    Warning {
        warning: TranslateWarning,
    },
    /// 訳文の増分
    Delta {
        text: String,
    },
    /// 出力速度。全体で1回
    Stats {
        stats: ReplyStats,
    },
    /// 完了、または中断
    Done,
    Error {
        error: AppError,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn events_are_tagged_by_type_in_camel_case() {
        let json = |event: TranslateEvent| serde_json::to_string(&event).unwrap();

        assert_eq!(
            json(TranslateEvent::Delta { text: "あ".into() }),
            r#"{"type":"delta","text":"あ"}"#
        );
        assert_eq!(json(TranslateEvent::Done), r#"{"type":"done"}"#);
        assert_eq!(
            json(TranslateEvent::Warning {
                warning: TranslateWarning::DelimiterRemoved
            }),
            r#"{"type":"warning","warning":"delimiterRemoved"}"#
        );
        assert_eq!(
            json(TranslateEvent::Stats {
                stats: ReplyStats {
                    tokens: 3,
                    elapsed_ms: 500,
                    estimated: false
                }
            }),
            r#"{"type":"stats","stats":{"tokens":3,"elapsedMs":500,"estimated":false}}"#
        );
        assert_eq!(
            json(TranslateEvent::Error {
                error: AppError::Timeout
            }),
            r#"{"type":"error","error":{"kind":"timeout"}}"#
        );
    }

    #[test]
    fn the_request_is_read_from_camel_case_json() {
        let request: TranslateRequest = serde_json::from_str(
            r#"{"requestId":"r","sourceLang":"en","targetLang":"ja","text":"hi"}"#,
        )
        .unwrap();

        assert_eq!(request.request_id, "r");
        assert_eq!(request.source_lang, Lang::En);
        assert_eq!(request.target_lang, Lang::Ja);
    }
}
