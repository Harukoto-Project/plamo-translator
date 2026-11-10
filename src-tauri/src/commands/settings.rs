//! 設定のコマンド。

use plamo_translator_core::error::AppError;
use plamo_translator_core::settings::Settings;
use tauri::State;

use crate::state::{AppState, blocking};

/// 保存されている設定。
#[tauri::command]
#[specta::specta]
pub async fn settings_get(state: State<'_, AppState>) -> Result<Settings, AppError> {
    let settings = state.settings.clone();
    blocking(move || settings.load()).await
}

/// 設定を検査して保存する。保存した内容(URLなどを整えたもの)を返す。
#[tauri::command]
#[specta::specta]
pub async fn settings_update(
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<Settings, AppError> {
    let store = state.settings.clone();
    blocking(move || store.save(settings)).await
}
