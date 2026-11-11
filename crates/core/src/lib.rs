//! plamo-translator の Tauri 非依存のロジックと型。
//!
//! Windows では Tauri をリンクした単体テストが起動できないため、
//! テストが必要なロジックはこのクレートに置き、`src-tauri` はコマンドの入口だけにする。

pub mod api;
pub mod app_info;
pub mod error;
pub mod fs;
pub mod importer;
pub mod profiles;
pub mod secrets;
pub mod settings;
pub mod translate;
