//! 設定の保存先(`settings.json`)。
//!
//! 書き込みは一時ファイル経由のアトミック書き込み。versionの方針:
//! 後方互換の追加(任意のフィールド)ではversionを上げず、読めない変更のときだけ上げる。
//! **新しいversionのファイルは読まず、上書きもしない**(`load` も `save` も失敗する)。

use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::model::Settings;
use crate::error::AppError;
use crate::fs::write_atomic;

/// このアプリが読み書きできるversion。
pub const SETTINGS_VERSION: u32 = 1;

const FILE_NAME: &str = "settings.json";

#[derive(Serialize, Deserialize)]
struct SettingsFile {
    version: u32,
    #[serde(flatten)]
    settings: Settings,
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
        self.read()
    }

    /// 設定を検査して保存する。保存した内容(URLなどを整えたもの)を返す。
    pub fn save(&self, settings: Settings) -> Result<Settings, AppError> {
        let settings = settings.validated()?;
        let _guard = self.guard();
        // 新しいversionのファイルを上書きしないよう、書く前に読んで確かめる
        self.read()?;
        let file = SettingsFile {
            version: SETTINGS_VERSION,
            settings,
        };
        let json = serde_json::to_vec_pretty(&file)
            .map_err(|e| AppError::internal(format!("設定を書き出せませんでした: {e}")))?;
        write_atomic(&self.path, &json).map_err(|e| AppError::SettingsWriteFailed {
            detail: e.to_string(),
        })?;
        Ok(file.settings)
    }

    fn guard(&self) -> std::sync::MutexGuard<'_, ()> {
        // ロック中にpanicしても、ファイルは壊れない(アトミック書き込み)ので続行してよい
        self.lock
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    fn read(&self) -> Result<Settings, AppError> {
        let text = match std::fs::read_to_string(&self.path) {
            Ok(text) => text,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Settings::default()),
            Err(e) => {
                return Err(AppError::SettingsReadFailed {
                    detail: e.to_string(),
                });
            }
        };
        let corrupt = |detail: String| AppError::SettingsReadFailed { detail };
        // 新しいversionは、形が違うかもしれないので、全体を読む前にversionだけ見る
        let value: Value = serde_json::from_str(&text).map_err(|e| corrupt(e.to_string()))?;
        let version = value["version"]
            .as_u64()
            .ok_or_else(|| corrupt("versionがありません".to_owned()))?;
        if version > u64::from(SETTINGS_VERSION) {
            return Err(AppError::SettingsVersionUnsupported {
                version: u32::try_from(version).unwrap_or(u32::MAX),
            });
        }
        let file: SettingsFile =
            serde_json::from_value(value).map_err(|e| corrupt(e.to_string()))?;
        Ok(file.settings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::model::{ConnectionSettings, GenerationSettings};

    fn custom() -> Settings {
        Settings {
            connection: ConnectionSettings {
                base_url: "http://localhost:1234/v1".into(),
                model: "m".into(),
            },
            generation: GenerationSettings { max_tokens: 256 },
        }
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
    }

    #[test]
    fn the_saved_content_is_normalized() {
        let dir = tempfile::tempdir().unwrap();
        let store = SettingsStore::new(dir.path());
        let mut settings = custom();
        settings.connection.base_url = " http://localhost:1234/v1/ ".into();

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
        assert_eq!(loaded.generation, GenerationSettings::default());
    }
}
