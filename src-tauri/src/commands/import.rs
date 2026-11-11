//! ファイル取り込みのコマンド。読み取りと抽出は `plamo_translator_core::importer` が行う。
//!
//! ダイアログはこのコマンドからだけ使う。画面(JS)にはダイアログプラグインの権限を与えない。
//! ドロップされたファイルはパスを受け取らない。バイト列(base64)だけを受け取り、任意のパスは読まない。

use plamo_translator_core::error::AppError;
use plamo_translator_core::importer::{self, ImportedText};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

use crate::state::blocking;

/// OSのダイアログでファイルを1つ選ばせ、中身のテキストを返す。
/// キャンセルしたときは値なし。元ファイルは保存しない。
#[tauri::command]
#[specta::specta]
pub async fn import_pick_file(
    app: AppHandle,
    title: String,
) -> Result<Option<ImportedText>, AppError> {
    let window = app.get_webview_window("main");
    blocking(move || {
        let mut picker = app.dialog().file().set_title(&title);
        if let Some(window) = &window {
            picker = picker.set_parent(window);
        }
        let Some(picked) = picker.blocking_pick_file() else {
            return Ok(None);
        };
        let path = picked.into_path().map_err(|_| AppError::FileReadFailed {
            detail: String::new(),
        })?;
        importer::import_path(&path).map(Some)
    })
    .await
}

/// ドロップされたファイルの中身(base64)からテキストを取り出す。
/// 種類は中身で判定する。元ファイルは保存しない。
#[tauri::command]
#[specta::specta]
pub async fn import_extract(data: String) -> Result<ImportedText, AppError> {
    blocking(move || importer::import_base64(&data)).await
}
