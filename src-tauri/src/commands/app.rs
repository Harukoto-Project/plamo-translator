//! アプリ自体の情報に関するコマンド。

use plamo_translator_core::app_info::AppInfo;

/// アプリ名とバージョンを返す。
#[tauri::command]
#[specta::specta]
pub fn app_info() -> AppInfo {
    AppInfo::new(env!("CARGO_PKG_NAME"), env!("CARGO_PKG_VERSION"))
}
