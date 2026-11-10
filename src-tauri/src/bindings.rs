//! tauri-specta の設定。Rust の型とコマンドから TypeScript の型を生成する。
//!
//! 生成物は `src/types/bindings.ts`。直接編集しない。
//! 生成のタイミング: `pnpm bindings`(`export-bindings`)のみ。アプリの起動時には書き出さない
//! (ソースツリーを書き換えて Vite の不要なリロードを招くため)。CI が生成物の差分を検査する。

use tauri_specta::{Builder, collect_commands};

use crate::commands;

/// フロントの型の出力先。実行時のカレントディレクトリに依存しないよう、ビルド時のパスから決める。
const BINDINGS_PATH: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/types/bindings.ts");

/// コマンドを登録した `Builder` を作る。
pub fn builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![commands::app::app_info])
}

/// TypeScript の型を書き出す。
pub fn export(builder: &Builder<tauri::Wry>) -> Result<(), Box<dyn std::error::Error>> {
    builder.export(specta_typescript::Typescript::default(), BINDINGS_PATH)?;
    Ok(())
}
