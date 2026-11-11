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
    // `#[serde(default)]` による読み込み時だけの違いで、型が `_Serialize` / `_Deserialize` に
    // 分裂しないよう、送受信で同じ型にまとめる(省略できる項目は `?` 付きになる)
    Builder::<tauri::Wry>::new()
        .disable_serde_phases()
        .commands(collect_commands![
            commands::app::app_info,
            commands::history::history_delete,
            commands::history::history_list,
            commands::history::history_load,
            commands::history::history_rename,
            commands::history::history_save,
            commands::import::import_extract,
            commands::import::import_pick_file,
            commands::profiles::models_list,
            commands::profiles::profiles_add,
            commands::profiles::profiles_get,
            commands::profiles::profiles_remove,
            commands::profiles::profiles_select_model,
            commands::profiles::profiles_set_active,
            commands::profiles::profiles_update,
            commands::secrets::secret_clear,
            commands::secrets::secret_set,
            commands::secrets::secret_status,
            commands::settings::settings_get,
            commands::settings::settings_update,
            commands::translate::translate_cancel,
            commands::translate::translate_start,
        ])
}

/// TypeScript の型を書き出す。
pub fn export(builder: &Builder<tauri::Wry>) -> Result<(), Box<dyn std::error::Error>> {
    builder.export(specta_typescript::Typescript::default(), BINDINGS_PATH)?;
    Ok(())
}
