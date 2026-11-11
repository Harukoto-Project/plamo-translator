//! 設定の保存先(`settings.json`)。
//!
//! 書き込みは一時ファイル経由のアトミック書き込み。versionの方針:
//! 後方互換の追加(任意のフィールド)ではversionを上げず、読めない変更のときだけ上げる。
//! **新しいversionのファイルは読まず、上書きもしない**(`load` も `save` も失敗する)。
//!
//! `profiles` が無いファイルは、`connection` からプロファイルを1件作って読む(ファイルは書き換えない)。
//! このアプリが知らない項目は、次に保存するときも残す。

use std::path::PathBuf;
use std::sync::Mutex;

use serde::Deserialize;
use serde_json::Value;

use super::model::{ConnectionSettings, GenerationSettings, Settings};
use crate::error::AppError;
use crate::fs::write_atomic;
use crate::profiles::ProfileBook;

/// このアプリが読み書きできるversion。
pub const SETTINGS_VERSION: u32 = 1;

const FILE_NAME: &str = "settings.json";

/// ファイルから読むときの形。`profiles` の有無で、古い単一の接続設定と区別する。
#[derive(Deserialize)]
struct StoredSettings {
    #[serde(default)]
    connection: ConnectionSettings,
    #[serde(default)]
    generation: GenerationSettings,
    #[serde(default)]
    profiles: Option<ProfileBook>,
}

struct Loaded {
    settings: Settings,
    /// ファイル全体。ファイルが無いときは `Null`。
    raw: Value,
}

/// `settings.json` の読み書き。読み込みと保存の間に他の書き込みが入らないよう直列化する。
pub struct SettingsStore {
    path: PathBuf,
    lock: Mutex<()>,
}

impl SettingsStore {
    /// `dir` はアプリのデータディレクトリ。
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        Self {
            path: dir.into().join(FILE_NAME),
            lock: Mutex::new(()),
        }
    }

    /// 保存されている設定。ファイルが無ければ初期値(保存はしない)。
    pub fn load(&self) -> Result<Settings, AppError> {
        let _guard = self.guard();
        Ok(self.read()?.settings)
    }

    /// 設定を検査して保存する。保存した内容(URLなどを整えたもの)を返す。
    pub fn save(&self, settings: Settings) -> Result<Settings, AppError> {
        let settings = settings.validated()?;
        let _guard = self.guard();
        let loaded = self.read()?;
        self.write(&settings, &loaded.raw)?;
        Ok(settings)
    }

    /// 読み込んでから書き戻す。途中で失敗したらファイルは変えない。
    pub fn update<F>(&self, mutate: F) -> Result<Settings, AppError>
    where
        F: FnOnce(&mut Settings) -> Result<(), AppError>,
    {
        let _guard = self.guard();
        let mut loaded = self.read()?;
        mutate(&mut loaded.settings)?;
        loaded.settings = loaded.settings.validated()?;
        self.write(&loaded.settings, &loaded.raw)?;
        Ok(loaded.settings)
    }

    /// 生成の設定だけを差し替える。接続プロファイルと、知らない項目はそのまま。
    pub fn update_generation(&self, generation: GenerationSettings) -> Result<Settings, AppError> {
        self.update(|settings| {
            settings.generation = generation;
            Ok(())
        })
    }

    fn guard(&self) -> std::sync::MutexGuard<'_, ()> {
        // ロック中にpanicしても、ファイルは壊れない(アトミック書き込み)ので続行してよい
        self.lock
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    fn read(&self) -> Result<Loaded, AppError> {
        let text = match std::fs::read_to_string(&self.path) {
            Ok(text) => text,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(Loaded {
                    settings: Settings::default(),
                    raw: Value::Null,
                });
            }
            Err(error) => {
                return Err(AppError::SettingsReadFailed {
                    detail: error.to_string(),
                });
            }
        };
        let corrupt = |detail: String| AppError::SettingsReadFailed { detail };
        // 新しいversionは、形が違うかもしれないので、全体を読む前にversionだけ見る
        let raw: Value = serde_json::from_str(&text).map_err(|error| corrupt(error.to_string()))?;
        let version = raw["version"]
            .as_u64()
            .ok_or_else(|| corrupt("versionがありません".to_owned()))?;
        if version > u64::from(SETTINGS_VERSION) {
            return Err(AppError::SettingsVersionUnsupported {
                version: u32::try_from(version).unwrap_or(u32::MAX),
            });
        }
        let stored: StoredSettings =
            serde_json::from_value(raw.clone()).map_err(|error| corrupt(error.to_string()))?;
        Ok(Loaded {
            settings: into_settings(stored),
            raw,
        })
    }

    fn write(&self, settings: &Settings, original: &Value) -> Result<(), AppError> {
        let mut value = serde_json::to_value(settings)
            .map_err(|error| AppError::internal(format!("設定を書き出せませんでした: {error}")))?;
        retain_unknown(&mut value, original);
        if let Some(object) = value.as_object_mut() {
            object.insert("version".to_owned(), Value::from(SETTINGS_VERSION));
        }
        let json = serde_json::to_vec_pretty(&value)
            .map_err(|error| AppError::internal(format!("設定を書き出せませんでした: {error}")))?;
        write_atomic(&self.path, &json).map_err(|error| AppError::SettingsWriteFailed {
            detail: error.to_string(),
        })?;
        Ok(())
    }
}

/// `profiles` が無ければ、単一の `connection` から作る。使用中の接続先を `connection` に写す。
fn into_settings(stored: StoredSettings) -> Settings {
    let profiles = match stored.profiles {
        Some(book) => book.normalized(),
        None => ProfileBook::from_connection(&stored.connection),
    };
    let mut settings = Settings {
        connection: stored.connection,
        generation: stored.generation,
        profiles,
    };
    settings.sync_connection();
    settings
}

/// このアプリが知らない項目を、書き出すJSONに残す。
///
/// トップレベルと、`connection` / `generation` の中だけ。`profiles` はこのアプリが形を決める。
fn retain_unknown(written: &mut Value, original: &Value) {
    let (Some(written_obj), Some(original_obj)) = (written.as_object_mut(), original.as_object())
    else {
        return;
    };
    let original_keys: Vec<(String, Value)> = original_obj
        .iter()
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect();
    for (key, value) in original_keys {
        if key == "version" {
            continue;
        }
        if !written_obj.contains_key(&key) {
            written_obj.insert(key, value);
            continue;
        }
        if matches!(key.as_str(), "connection" | "generation") {
            merge_unknown_object(written_obj.get_mut(&key), &value);
        }
    }
}

fn merge_unknown_object(written: Option<&mut Value>, original: &Value) {
    let (Some(written), Some(original)) =
        (written.and_then(Value::as_object_mut), original.as_object())
    else {
        return;
    };
    for (key, value) in original {
        if !written.contains_key(key) {
            written.insert(key.clone(), value.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::model::GenerationSettings;

    fn custom() -> Settings {
        let mut settings = Settings::default();
        let profile = &mut settings.profiles.profiles[0];
        profile.name = "LM Studio".into();
        profile.base_url = "http://localhost:1234/v1".into();
        profile.model = "m".into();
        settings.generation.max_tokens = 256;
        settings.sync_connection();
        settings
    }

    #[test]
    fn a_missing_file_gives_the_defaults_without_creating_it() {
        let dir = tempfile::tempdir().unwrap();
        let store = SettingsStore::new(dir.path());

        assert_eq!(store.load().unwrap(), Settings::default());
        assert!(!dir.path().join("settings.json").exists());
    }

    #[test]
    fn saves_and_loads_a_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let store = SettingsStore::new(dir.path());

        let saved = store.save(custom()).unwrap();

        assert_eq!(saved, custom());
        assert_eq!(SettingsStore::new(dir.path()).load().unwrap(), custom());
    }

    #[test]
    fn the_file_has_a_version_and_camel_case_fields() {
        let dir = tempfile::tempdir().unwrap();
        SettingsStore::new(dir.path()).save(custom()).unwrap();

        let text = std::fs::read_to_string(dir.path().join("settings.json")).unwrap();
        let value: Value = serde_json::from_str(&text).unwrap();

        assert_eq!(value["version"], 1);
        assert_eq!(value["connection"]["baseUrl"], "http://localhost:1234/v1");
        assert_eq!(value["generation"]["maxTokens"], 256);
        assert_eq!(value["generation"]["chunkBudget"], 1500);
        assert_eq!(value["profiles"]["activeId"], "default");
        assert_eq!(value["profiles"]["profiles"][0]["model"], "m");
    }

    #[test]
    fn the_saved_content_is_normalized() {
        let dir = tempfile::tempdir().unwrap();
        let store = SettingsStore::new(dir.path());
        let mut settings = custom();
        settings.profiles.profiles[0].base_url = " http://localhost:1234/v1/ ".into();

        let saved = store.save(settings).unwrap();

        assert_eq!(saved.connection.base_url, "http://localhost:1234/v1");
    }

    #[test]
    fn invalid_settings_are_not_written() {
        let dir = tempfile::tempdir().unwrap();
        let store = SettingsStore::new(dir.path());
        let mut settings = custom();
        settings.generation.max_tokens = 0;

        assert_eq!(
            store.save(settings).unwrap_err(),
            AppError::InvalidMaxTokens
        );
        assert!(!dir.path().join("settings.json").exists());
    }

    #[test]
    fn a_newer_version_is_neither_read_nor_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let newer = r#"{"version":99,"somethingNew":true}"#;
        std::fs::write(&path, newer).unwrap();
        let store = SettingsStore::new(dir.path());

        assert_eq!(
            store.load().unwrap_err(),
            AppError::SettingsVersionUnsupported { version: 99 }
        );
        assert_eq!(
            store.save(custom()).unwrap_err(),
            AppError::SettingsVersionUnsupported { version: 99 }
        );
        assert_eq!(std::fs::read_to_string(&path).unwrap(), newer);
    }

    #[test]
    fn a_broken_file_is_a_read_error_and_is_not_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, "{ not json").unwrap();
        let store = SettingsStore::new(dir.path());

        assert!(matches!(
            store.load(),
            Err(AppError::SettingsReadFailed { .. })
        ));
        assert!(matches!(
            store.save(custom()),
            Err(AppError::SettingsReadFailed { .. })
        ));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{ not json");
    }

    #[test]
    fn a_file_without_a_version_is_a_read_error() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("settings.json"), "{}").unwrap();

        assert!(matches!(
            SettingsStore::new(dir.path()).load(),
            Err(AppError::SettingsReadFailed { .. })
        ));
    }

    #[test]
    fn fields_added_later_default_when_missing_from_an_old_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("settings.json"),
            r#"{"version":1,"connection":{"baseUrl":"http://h:1/v1","model":"x"}}"#,
        )
        .unwrap();

        let loaded = SettingsStore::new(dir.path()).load().unwrap();

        assert_eq!(loaded.connection.base_url, "http://h:1/v1");
        assert_eq!(loaded.connection.model, "x");
        assert_eq!(loaded.generation, GenerationSettings::default());
        assert_eq!(
            loaded.generation.chunk_budget,
            crate::settings::DEFAULT_CHUNK_BUDGET
        );
        assert_eq!(loaded.profiles.active_id, "default");
        assert_eq!(loaded.profiles.profiles[0].model, "x");
    }

    #[test]
    fn a_file_without_profiles_is_migrated_in_memory_and_not_rewritten() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let original = r#"{"version":1,"connection":{"baseUrl":"http://localhost:11434/v1","model":"old"},"generation":{"maxTokens":32}}"#;
        std::fs::write(&path, original).unwrap();

        let loaded = SettingsStore::new(dir.path()).load().unwrap();

        assert_eq!(loaded.profiles.profiles.len(), 1);
        assert_eq!(loaded.profiles.active_id, "default");
        assert_eq!(loaded.profiles.profiles[0].name, "Ollama");
        assert_eq!(
            loaded.profiles.profiles[0].base_url,
            "http://localhost:11434/v1"
        );
        assert_eq!(loaded.connection.model, "old");
        assert_eq!(loaded.generation.max_tokens, 32);
        assert_eq!(
            loaded.generation.chunk_budget,
            crate::settings::DEFAULT_CHUNK_BUDGET
        );
        assert_eq!(std::fs::read_to_string(&path).unwrap(), original);
    }

    #[test]
    fn saving_after_migration_keeps_version_one_and_writes_profiles() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(
            &path,
            r#"{"version":1,"connection":{"baseUrl":"http://localhost:8080/v1","model":"old"},"generation":{"maxTokens":32}}"#,
        )
        .unwrap();
        let store = SettingsStore::new(dir.path());
        let loaded = store.load().unwrap();

        store.save(loaded).unwrap();

        let value: Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(value["version"], 1);
        assert_eq!(value["profiles"]["profiles"][0]["name"], "llama.cpp");
        assert_eq!(value["connection"]["baseUrl"], "http://localhost:8080/v1");
        assert_eq!(value["generation"]["maxTokens"], 32);
    }

    #[test]
    fn updating_generation_keeps_profiles_and_unknown_fields() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(
            &path,
            r#"{"version":1,"futureFlag":true,"connection":{"baseUrl":"http://h:1/v1","model":"x","futureUrl":1},"generation":{"maxTokens":8,"futureBudget":1500}}"#,
        )
        .unwrap();
        let store = SettingsStore::new(dir.path());

        let saved = store
            .update_generation(GenerationSettings {
                max_tokens: 64,
                ..GenerationSettings::default()
            })
            .unwrap();

        assert_eq!(saved.generation.max_tokens, 64);
        assert_eq!(saved.profiles.profiles[0].base_url, "http://h:1/v1");
        let value: Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(value["futureFlag"], true);
        assert_eq!(value["connection"]["futureUrl"], 1);
        assert_eq!(value["connection"]["baseUrl"], "http://h:1/v1");
        assert_eq!(value["generation"]["maxTokens"], 64);
        assert_eq!(value["generation"]["futureBudget"], 1500);
        assert!(value["profiles"]["profiles"].as_array().unwrap().len() == 1);
    }

    #[test]
    fn update_generation_does_not_write_when_the_value_is_invalid() {
        let dir = tempfile::tempdir().unwrap();
        let store = SettingsStore::new(dir.path());
        store.save(custom()).unwrap();

        assert_eq!(
            store
                .update_generation(GenerationSettings {
                    max_tokens: 0,
                    ..GenerationSettings::default()
                })
                .unwrap_err(),
            AppError::InvalidMaxTokens
        );
        assert_eq!(
            SettingsStore::new(dir.path())
                .load()
                .unwrap()
                .generation
                .max_tokens,
            256
        );
    }
}
