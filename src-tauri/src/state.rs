//! アプリ全体で共有する状態。Tauriの `State` として各コマンドに渡す。

use std::path::PathBuf;
use std::sync::Arc;

use plamo_translator_core::api::ApiClient;
use plamo_translator_core::error::AppError;
use plamo_translator_core::history::HistoryStore;
use plamo_translator_core::profiles::ProfileService;
use plamo_translator_core::secrets::{KeyringStore, SecretStore};
use plamo_translator_core::settings::SettingsStore;

pub struct AppState {
    pub api: ApiClient,
    /// 設定ファイル(`<データディレクトリ>/settings.json`)
    pub settings: Arc<SettingsStore>,
    /// 接続プロファイルと、プロファイルごとのAPIキー
    pub profiles: Arc<ProfileService>,
    /// 翻訳履歴(`<データディレクトリ>/history/<id>.json`)
    pub history: Arc<HistoryStore>,
}

impl AppState {
    /// `data_dir` はアプリのデータディレクトリ。
    pub fn new(data_dir: PathBuf) -> Result<Self, AppError> {
        let settings = Arc::new(SettingsStore::new(data_dir.clone()));
        let secrets: Arc<dyn SecretStore> = Arc::new(KeyringStore);
        Ok(Self {
            api: ApiClient::new()?,
            profiles: Arc::new(ProfileService::new(settings.clone(), secrets)),
            settings,
            history: Arc::new(HistoryStore::new(data_dir.join("history"))),
        })
    }
}

/// ファイルやOSの資格情報ストアを触る同期の処理を、非同期ランタイムを塞がない別スレッドで実行する。
/// (Secret Service がロック解除を待つなど、時間がかかることがある。)
pub async fn blocking<T, F>(work: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, AppError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| AppError::internal(format!("内部エラーが発生しました: {error}")))?
}
