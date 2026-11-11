//! プロファイルの操作(一覧・更新・キー)をまとめた入口。`commands/` はこれを呼ぶだけにする。

use std::sync::Arc;

use serde::Serialize;
use specta::Type;

use super::book::ProfileBook;
use super::keys::{KeyStatus, ProfileKeys};
use super::model::{ConnectionProfile, is_valid_id};
use super::preset::ProfilePreset;
use crate::api::Connection;
use crate::error::AppError;
use crate::secrets::SecretStore;
use crate::settings::SettingsStore;

/// プロファイルを追加した結果。画面が、追加したものを開けるようにIDを添える。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileAdded {
    pub book: ProfileBook,
    pub id: String,
}

/// 翻訳に使う、使用中プロファイルの接続情報と最大出力トークン数。
///
/// キーを持つので、IPCの戻り値にはしない(`Serialize` を付けない)。
pub struct ActiveConnection {
    pub connection: Connection,
    pub max_tokens: u32,
}

/// 既存と重ならない新しいID(`p` + 時刻のナノ秒の16進。万一重なれば1つずつずらす)。
fn new_profile_id(book: &ProfileBook) -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    (0u128..)
        .map(|offset| format!("p{:x}", nanos.saturating_add(offset)))
        .find(|id| book.find(id).is_none() && is_valid_id(id))
        .expect("いつかは空きが見つかる")
}

/// プロファイルとAPIキーの操作。
pub struct ProfileService {
    store: Arc<SettingsStore>,
    keys: ProfileKeys,
}

impl ProfileService {
    /// `store` は、画面の設定と共有する設定ファイル(ロックを共有するため、同じインスタンスを渡す)。
    pub fn new(store: Arc<SettingsStore>, secrets: Arc<dyn SecretStore>) -> Self {
        Self {
            store,
            keys: ProfileKeys::new(secrets),
        }
    }

    pub fn book(&self) -> Result<ProfileBook, AppError> {
        Ok(self.store.load()?.profiles)
    }

    /// 既存のプロファイルを、検査した入力で更新する。更新後の一覧を返す。
    pub fn update_profile(&self, input: &ConnectionProfile) -> Result<ProfileBook, AppError> {
        let profile = input.validated()?;
        let settings = self
            .store
            .update(|settings| settings.profiles.replace(profile))?;
        Ok(settings.profiles)
    }

    /// 雛形から新しいプロファイルを末尾に追加する(使用中は変えない)。
    pub fn add_profile(&self, preset: ProfilePreset) -> Result<ProfileAdded, AppError> {
        let mut id = String::new();
        let settings = self.store.update(|settings| {
            id = new_profile_id(&settings.profiles);
            let name = settings.profiles.unique_name(preset.label());
            settings.profiles.add(preset.profile(id.clone(), name))
        })?;
        Ok(ProfileAdded {
            book: settings.profiles,
            id,
        })
    }

    /// プロファイルを削除し、そのAPIキーも消す。最後の1件は削除できない。
    pub fn remove_profile(&self, profile_id: &str) -> Result<ProfileBook, AppError> {
        self.require_profile(profile_id)?;
        let settings = self
            .store
            .update(|settings| settings.profiles.remove(profile_id))?;
        // 設定の保存に成功してから消す(キーだけ先に消えて、プロファイルが残る状態を避ける)
        self.keys.clear(profile_id);
        Ok(settings.profiles)
    }

    /// 使用中のプロファイルを切り替える。
    pub fn set_active(&self, profile_id: &str) -> Result<ProfileBook, AppError> {
        self.require_profile(profile_id)?;
        let settings = self
            .store
            .update(|settings| settings.profiles.set_active(profile_id))?;
        Ok(settings.profiles)
    }

    /// プロファイルのモデルを選び、そのプロファイルを使用中にする。
    pub fn select_model(
        &self,
        profile_id: &str,
        model: Option<&str>,
    ) -> Result<ProfileBook, AppError> {
        self.require_profile(profile_id)?;
        let settings = self
            .store
            .update(|settings| settings.profiles.select_model(profile_id, model))?;
        Ok(settings.profiles)
    }

    /// 使用中のプロファイルで翻訳するための接続情報。
    pub fn active_connection(&self) -> Result<ActiveConnection, AppError> {
        let settings = self.store.load()?;
        let profile = settings
            .profiles
            .active()
            .ok_or(AppError::ProfileNotFound)?;
        Ok(ActiveConnection {
            connection: profile.connection(&self.keys.get(&profile.id)),
            max_tokens: settings.generation.max_tokens,
        })
    }

    /// 保存済みのプロファイルに接続するための情報(キーを含む)。モデル一覧の取得に使う。
    pub fn connection_of(&self, profile_id: &str) -> Result<Connection, AppError> {
        let profile = self.profile(profile_id)?;
        Ok(profile.connection(&self.keys.get(profile_id)))
    }

    pub fn set_key(&self, profile_id: &str, key: &str) -> Result<KeyStatus, AppError> {
        self.require_profile(profile_id)?;
        Ok(self.keys.set(profile_id, key))
    }

    pub fn clear_key(&self, profile_id: &str) -> Result<KeyStatus, AppError> {
        self.require_profile(profile_id)?;
        Ok(self.keys.clear(profile_id))
    }

    pub fn key_status(&self, profile_id: &str) -> Result<KeyStatus, AppError> {
        self.require_profile(profile_id)?;
        Ok(self.keys.status(profile_id))
    }

    fn require_profile(&self, profile_id: &str) -> Result<(), AppError> {
        self.profile(profile_id).map(|_| ())
    }

    fn profile(&self, profile_id: &str) -> Result<ConnectionProfile, AppError> {
        if !is_valid_id(profile_id) {
            return Err(AppError::ProfileNotFound);
        }
        self.store
            .load()?
            .profiles
            .find(profile_id)
            .cloned()
            .ok_or(AppError::ProfileNotFound)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::secrets::testing::MemoryStore;
    use crate::settings::DEFAULT_MODEL;

    fn service(dir: &std::path::Path, secrets: &MemoryStore) -> ProfileService {
        ProfileService::new(Arc::new(SettingsStore::new(dir)), Arc::new(secrets.clone()))
    }

    #[test]
    fn the_first_launch_has_the_default_profile_and_no_file() {
        let dir = tempfile::tempdir().unwrap();
        let book = service(dir.path(), &MemoryStore::default()).book().unwrap();

        assert_eq!(book, ProfileBook::default());
        assert!(!dir.path().join("settings.json").exists());
    }

    #[test]
    fn update_validates_persists_and_mirrors_the_active_connection() {
        let dir = tempfile::tempdir().unwrap();
        let profiles = service(dir.path(), &MemoryStore::default());
        let input = ConnectionProfile {
            name: " 自宅 ".into(),
            base_url: "http://10.0.0.2:1234/v1/".into(),
            model: " m ".into(),
            ..ProfileBook::default().profiles.remove(0)
        };

        let book = profiles.update_profile(&input).unwrap();
        let saved = book.find("default").unwrap();
        assert_eq!(saved.name, "自宅");
        assert_eq!(saved.base_url, "http://10.0.0.2:1234/v1");
        assert_eq!(saved.model, "m");

        let settings = SettingsStore::new(dir.path()).load().unwrap();
        assert_eq!(settings.connection.base_url, saved.base_url);
        assert_eq!(settings.connection.model, saved.model);
        assert_eq!(settings.generation.max_tokens, 1024);
    }

    #[test]
    fn an_invalid_update_is_rejected_and_nothing_is_saved() {
        let dir = tempfile::tempdir().unwrap();
        let profiles = service(dir.path(), &MemoryStore::default());
        let input = ConnectionProfile {
            base_url: "nope".into(),
            ..ProfileBook::default().profiles.remove(0)
        };

        assert!(profiles.update_profile(&input).is_err());
        assert!(!dir.path().join("settings.json").exists());
    }

    #[test]
    fn add_keeps_the_active_profile_and_names_uniquely() {
        let dir = tempfile::tempdir().unwrap();
        let profiles = service(dir.path(), &MemoryStore::default());

        let added = profiles.add_profile(ProfilePreset::Ollama).unwrap();

        assert_eq!(added.book.active_id, "default");
        let created = added.book.find(&added.id).unwrap();
        assert_eq!(created.name, "Ollama");
        assert_eq!(created.base_url, "http://localhost:11434/v1");
        assert_eq!(created.model, DEFAULT_MODEL);
        assert!(is_valid_id(&added.id));
    }

    #[test]
    fn removing_a_profile_also_removes_its_key_and_keeps_the_other() {
        let dir = tempfile::tempdir().unwrap();
        let secrets = MemoryStore::default();
        let profiles = service(dir.path(), &secrets);
        let added = profiles.add_profile(ProfilePreset::LmStudio).unwrap();
        profiles.set_key(&added.id, "secret").unwrap();
        profiles.set_key("default", "keep").unwrap();

        profiles.remove_profile(&added.id).unwrap();

        assert_eq!(
            secrets.value(&format!("profile:{}:api_key", added.id)),
            None
        );
        assert_eq!(
            secrets.value("profile:default:api_key").as_deref(),
            Some("keep")
        );
        assert_eq!(profiles.book().unwrap().profiles.len(), 1);
    }

    #[test]
    fn the_last_profile_cannot_be_removed() {
        let dir = tempfile::tempdir().unwrap();
        let profiles = service(dir.path(), &MemoryStore::default());
        assert_eq!(
            profiles.remove_profile("default").unwrap_err(),
            AppError::LastProfile
        );
    }

    #[test]
    fn select_model_switches_the_active_profile_used_for_translation() {
        let dir = tempfile::tempdir().unwrap();
        let profiles = service(dir.path(), &MemoryStore::default());
        let added = profiles.add_profile(ProfilePreset::Ollama).unwrap();

        profiles.select_model(&added.id, Some("other")).unwrap();

        let active = profiles.active_connection().unwrap();
        assert_eq!(active.connection.base_url, "http://localhost:11434/v1");
        assert_eq!(active.connection.model, "other");
        assert_eq!(active.connection.api_key, "");
        assert_eq!(active.max_tokens, 1024);
    }

    #[test]
    fn the_active_connection_uses_that_profiles_key() {
        let dir = tempfile::tempdir().unwrap();
        let profiles = service(dir.path(), &MemoryStore::default());
        profiles.set_key("default", "sk").unwrap();

        let active = profiles.active_connection().unwrap();
        assert_eq!(active.connection.api_key, "sk");
        assert_eq!(active.connection.model, DEFAULT_MODEL);
    }

    #[test]
    fn an_unknown_profile_is_not_found_for_keys_and_models() {
        let dir = tempfile::tempdir().unwrap();
        let profiles = service(dir.path(), &MemoryStore::default());
        assert_eq!(
            profiles.set_key("nope", "k").unwrap_err(),
            AppError::ProfileNotFound
        );
        assert_eq!(
            profiles.connection_of("../x").unwrap_err(),
            AppError::ProfileNotFound
        );
    }
}
