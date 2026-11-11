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

/// 生成の設定(`generation`)だけを検査して保存する。
///
/// 分割の文字数も `generation` にあり、接続先には属さない。
/// 接続先はプロファイルのコマンドが更新する。引数の `connection` と `profiles` は使わない。
/// 知らない項目と、使用中プロファイルから書き戻した `connection` は残す。
#[tauri::command]
#[specta::specta]
pub async fn settings_update(
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<Settings, AppError> {
    let store = state.settings.clone();
    blocking(move || store.update_generation(settings.generation)).await
}
