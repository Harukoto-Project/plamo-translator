//! 履歴の型と、保存するファイルの形。

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::translate::Lang;

/// このアプリが読み書きできるversion。
///
/// 後方互換の追加(任意のフィールド)では上げない。読めない変更のときだけ上げる。
pub const HISTORY_VERSION: u32 = 1;

/// 一覧に出す1件。原文と訳文は含まない。時刻はUNIX秒。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HistorySummary {
    pub id: String,
    pub title: String,
    pub created_at: u32,
    pub updated_at: u32,
}

/// 履歴1件。開いたとき、原文・訳文・言語を画面に戻すために使う。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub title: String,
    pub created_at: u32,
    pub updated_at: u32,
    /// 自動判定で解決した値。`auto` は保存しない
    pub source_lang: Lang,
    pub target_lang: Lang,
    pub source_text: String,
    pub target_text: String,
    /// 翻訳に使ったモデル名。空なら、サーバーの既定に任せたということ
    pub model: String,
}

/// 履歴の保存の依頼。原文か訳文が空白だけなら、何も保存しない。
///
/// 接続先のURLとAPIキーは含めない。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SaveHistory {
    /// フロントが発行するUUID。1回の完了した翻訳につき1つ
    pub id: String,
    pub source_lang: Lang,
    pub target_lang: Lang,
    pub source_text: String,
    pub target_text: String,
    pub model: String,
}

/// 履歴の一覧。読めなかったファイルは一覧に入れず、件数だけ知らせる(ファイルには触らない)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HistoryListing {
    /// 更新が新しい順
    pub entries: Vec<HistorySummary>,
    /// 壊れている、または新しいversionのため一覧から外したファイルの数
    pub skipped: u32,
}

/// ディスク上の1ファイル。ファイル名(`<id>.json`)が正で、中の `id` は参考にしない。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct HistoryFile {
    pub version: u32,
    /// 読み込みでは使わない(無くてもよい)
    #[serde(default)]
    pub id: String,
    pub title: String,
    pub created_at: u32,
    pub updated_at: u32,
    pub source_lang: Lang,
    pub target_lang: Lang,
    pub source_text: String,
    pub target_text: String,
    /// 後から足した項目。無いファイルは空文字として読む
    #[serde(default)]
    pub model: String,
}

/// 一覧用に、原文と訳文を読み飛ばして読む形。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct MetaFile {
    pub title: String,
    pub created_at: u32,
    pub updated_at: u32,
}
