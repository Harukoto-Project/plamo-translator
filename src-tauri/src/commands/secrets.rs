//! APIキーのコマンド。
//!
//! **キーの値を返すコマンドは作らない。** フロントが知れるのは、プロファイルごとの状態(`KeyStatus`)だけ。

use plamo_translator_core::error::AppError;
use plamo_translator_core::profiles::KeyStatus;
use tauri::State;

use crate::state::{AppState, blocking};

/// プロファイルのAPIキーを設定する(空なら削除)。設定後の状態を返す。
#[tauri::command]
#[specta::specta]
pub async fn secret_set(
    state: State<'_, AppState>,
    profile_id: String,
    value: String,
) -> Result<KeyStatus, AppError> {
    let profiles = state.profiles.clone();
    blocking(move || profiles.set_key(&profile_id, &value)).await
}

/// プロファイルのAPIキーを削除する。
#[tauri::command]
#[specta::specta]
pub async fn secret_clear(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<KeyStatus, AppError> {
    let profiles = state.profiles.clone();
    blocking(move || profiles.clear_key(&profile_id)).await
}

/// プロファイルのAPIキーの状態(未設定・保存済み・未保存)。
#[tauri::command]
#[specta::specta]
pub async fn secret_status(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<KeyStatus, AppError> {
    let profiles = state.profiles.clone();
    blocking(move || profiles.key_status(&profile_id)).await
}
