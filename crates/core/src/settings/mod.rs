//! 設定ファイル(`settings.json`)。接続先と生成の設定を1つのファイルに持つ。
//!
//! 読み書きは `store` に集約し、ファイルの形(version・アトミック書き込み)はそこだけが知る。
//! APIキーは含まない(OSの資格情報ストアにある。→ `secrets`)。

mod model;
mod store;
mod url;

pub use model::{
    ConnectionSettings, DEFAULT_BASE_URL, DEFAULT_CHUNK_BUDGET, DEFAULT_MAX_TOKENS, DEFAULT_MODEL,
    GenerationSettings, MAX_CHUNK_BUDGET, MAX_MAX_TOKENS, Settings,
};
pub use store::{SETTINGS_VERSION, SettingsStore};
pub use url::validate_base_url;
