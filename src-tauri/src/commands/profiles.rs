//! 接続プロファイルのコマンド。キーは扱わない(→ `secrets`)。

use plamo_translator_core::error::AppError;
use plamo_translator_core::profiles::{
    ConnectionProfile, ProfileAdded, ProfileBook, ProfilePreset,
};
use tauri::State;

use crate::state::{AppState, blocking};

/// プロファイルの一覧と、使用中のプロファイル。キーは含まない。
#[tauri::command]
#[specta::specta]
pub async fn profiles_get(state: State<'_, AppState>) -> Result<ProfileBook, AppError> {
    let profiles = state.profiles.clone();
    blocking(move || profiles.book()).await
}

/// 既存のプロファイルを更新する。入力を検査し、更新後の一覧を返す。
#[tauri::command]
#[specta::specta]
pub async fn profiles_update(
    state: State<'_, AppState>,
    profile: ConnectionProfile,
) -> Result<ProfileBook, AppError> {
    let profiles = state.profiles.clone();
    blocking(move || profiles.update_profile(&profile)).await
}

/// 雛形(vLLM・llama.cpp・LM Studio・Ollama・カスタム)から新しいプロファイルを追加する。
#[tauri::command]
#[specta::specta]
pub async fn profiles_add(
    state: State<'_, AppState>,
    preset: ProfilePreset,
) -> Result<ProfileAdded, AppError> {
    let profiles = state.profiles.clone();
    blocking(move || profiles.add_profile(preset)).await
}

/// プロファイルを削除する(APIキーも消える)。最後の1件は削除できない。
#[tauri::command]
#[specta::specta]
pub async fn profiles_remove(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<ProfileBook, AppError> {
    let profiles = state.profiles.clone();
    blocking(move || profiles.remove_profile(&profile_id)).await
}

/// 使用中のプロファイルを切り替える。
#[tauri::command]
#[specta::specta]
pub async fn profiles_set_active(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<ProfileBook, AppError> {
    let profiles = state.profiles.clone();
    blocking(move || profiles.set_active(&profile_id)).await
}

/// プロファイルのモデルを選び、そのプロファイルを使用中にする。空ならサーバーの既定。
#[tauri::command]
#[specta::specta]
pub async fn profiles_select_model(
    state: State<'_, AppState>,
    profile_id: String,
    model: Option<String>,
) -> Result<ProfileBook, AppError> {
    let profiles = state.profiles.clone();
    blocking(move || profiles.select_model(&profile_id, model.as_deref())).await
}

/// 保存済みのプロファイルの `/models` から、モデルIDの一覧を返す。
///
/// 保存済みのURLとキーで問い合わせる。キーの値は返さない。
#[tauri::command]
#[specta::specta]
pub async fn models_list(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<Vec<String>, AppError> {
    let profiles = state.profiles.clone();
    let connection = blocking(move || profiles.connection_of(&profile_id)).await?;
    state.api.list_models(&connection).await
}
