//! 翻訳の履歴。1翻訳 = 1ファイルのJSONで、アプリのデータディレクトリに置く。
//!
//! `model` は型とファイルの形、`title` はタイトルを作る純粋関数、`store` はファイルの読み書き。
//! 検索と日付のグループ分けは、一覧のメタデータだけで済むのでフロントで行う。
//! タイトルは原文の先頭から作る。AIには作らせない。

mod id;
mod model;
mod store;
mod title;

use std::time::{SystemTime, UNIX_EPOCH};

pub use model::{HISTORY_VERSION, HistoryEntry, HistoryListing, HistorySummary, SaveHistory};
pub use store::HistoryStore;

/// 現在の時刻(UNIX秒)。保存の関数は時刻を引数で受け取るので、呼び出し側がこれを渡す。
pub fn unix_now() -> u32 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| {
            u32::try_from(elapsed.as_secs()).unwrap_or(u32::MAX)
        })
}
