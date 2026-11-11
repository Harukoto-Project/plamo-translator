//! 翻訳履歴のコマンド。ファイルの読み書きは `plamo_translator_core::history` が行う。

use plamo_translator_core::error::AppError;
use plamo_translator_core::history::{
    HistoryEntry, HistoryListing, HistorySummary, SaveHistory, unix_now,
};
use tauri::State;

use crate::state::{AppState, blocking};

/// 履歴の一覧(更新が新しい順)。原文と訳文は含まない。
#[tauri::command]
#[specta::specta]
pub async fn history_list(state: State<'_, AppState>) -> Result<HistoryListing, AppError> {
    let history = state.history.clone();
    blocking(move || history.list()).await
}

/// 履歴1件(原文と訳文を含む)。
#[tauri::command]
#[specta::specta]
pub async fn history_load(
    state: State<'_, AppState>,
    id: String,
) -> Result<HistoryEntry, AppError> {
    let history = state.history.clone();
    blocking(move || history.load(&id)).await
}

/// 完了した翻訳を保存する。原文か訳文が空白だけなら、何も保存せず `None`。
///
/// 中断やエラーで終わった翻訳は、このコマンドを呼ばない(呼び出すかどうかはフロントが決める)。
#[tauri::command]
#[specta::specta]
pub async fn history_save(
    state: State<'_, AppState>,
    entry: SaveHistory,
) -> Result<Option<HistorySummary>, AppError> {
    let history = state.history.clone();
    blocking(move || history.save(entry, unix_now())).await
}

/// 履歴の名前を変える。
#[tauri::command]
#[specta::specta]
pub async fn history_rename(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> Result<HistorySummary, AppError> {
    let history = state.history.clone();
    blocking(move || history.rename(&id, &title)).await
}

/// 履歴を削除する。
#[tauri::command]
#[specta::specta]
pub async fn history_delete(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let history = state.history.clone();
    blocking(move || history.delete(&id)).await
}
