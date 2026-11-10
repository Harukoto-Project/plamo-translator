//! plamo-translator の Tauri 非依存のロジックと型。
//!
//! Windows では Tauri をリンクした単体テストが起動できないため、
//! テストが必要なロジックはこのクレートに置き、`src-tauri` はコマンドの入口だけにする。

pub mod app_info;
