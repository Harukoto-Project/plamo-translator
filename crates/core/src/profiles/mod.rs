//! 接続プロファイル(vLLM・llama.cpp・LM Studio・Ollamaなど)と、プロファイルごとのAPIキー。
//!
//! UIに依存しないデータとロジックだけを置く。`model` は1件、`book` は一覧と使用中のもの、
//! `preset` は追加するときの雛形、`keys` はOSの資格情報ストアのAPIキー、
//! `service` はそれらと設定ファイル(→ `settings`)をまとめた入口。

mod book;
mod keys;
mod model;
mod preset;
mod service;

pub use book::ProfileBook;
pub use keys::{KeyStatus, ProfileKeys, api_key_account};
pub use model::{ConnectionProfile, DEFAULT_PROFILE_ID, MAX_NAME_CHARS, is_valid_id};
pub use preset::ProfilePreset;
pub use service::{ActiveConnection, ProfileAdded, ProfileService};
