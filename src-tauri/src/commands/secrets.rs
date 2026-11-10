//! APIキーのコマンド。
//!
//! **キーの値を返すコマンドは作らない。** フロントが知れるのは、キーの有無(`KeyStatus`)だけ。

use plamo_translator_core::error::AppError;
use plamo_translator_core::secrets::{self, KeyStatus};
use tauri::State;

use crate::state::{AppState, blocking};

/// APIキーを設定する(空なら削除)。設定後の状態を返す。
#[tauri::command]
#[specta::specta]
pub async fn secret_set(state: State<'_, AppState>, value: String) -> Result<KeyStatus, AppError> {
    let store = state.secrets.clone();
    blocking(move || secrets::set_key(store.as_ref(), &value)).await
}

/// APIキーを削除する。
#[tauri::command]
#[specta::specta]
pub async fn secret_clear(state: State<'_, AppState>) -> Result<KeyStatus, AppError> {
    let store = state.secrets.clone();
    blocking(move || secrets::clear_key(store.as_ref())).await
}

/// APIキーの状態(未設定・保存済み)。
#[tauri::command]
#[specta::specta]
pub async fn secret_status(state: State<'_, AppState>) -> Result<KeyStatus, AppError> {
    let store = state.secrets.clone();
    blocking(move || secrets::key_status(store.as_ref())).await
}
