//! プロファイルのAPIキー。OSの資格情報ストアに保存する。
//!
//! キーは設定ファイルには書かない。アプリの実行中はメモリにも持ち、変更のたびにストアへ書き通す。
//! ストアに書けなくても致命にはしない(キーはメモリに残り、`Unsaved` として警告する)。
//! フロントへキーの値を返す経路は作らない。

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use specta::Type;

use crate::secrets::{SecretStore, put_or_delete};

/// キーの状態。設定画面の表示用。値そのものは含まない。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum KeyStatus {
    /// キーは設定されていない
    Unset,
    /// OSの資格情報ストアに保存されている
    Saved,
    /// ストアに書けず、メモリにだけある。アプリを終了すると失われる
    Unsaved,
}

/// プロファイルのキーを入れておくストアのアカウント名。名前を変えてもキーが動かないようIDから決める。
pub fn api_key_account(profile_id: &str) -> String {
    format!("profile:{profile_id}:api_key")
}

#[derive(Default)]
struct Inner {
    /// プロファイルIDごとの現在のキー。空のキーは持たない
    keys: HashMap<String, String>,
    /// ストアから読み込み済みのプロファイル
    loaded: HashSet<String>,
    /// 現在の値がストアと食い違っているプロファイル(空にしたい場合も含む)
    unsaved: HashSet<String>,
}

/// プロファイルごとのAPIキー。
pub struct ProfileKeys {
    store: Arc<dyn SecretStore>,
    inner: Mutex<Inner>,
}

impl ProfileKeys {
    pub fn new(store: Arc<dyn SecretStore>) -> Self {
        Self {
            store,
            inner: Mutex::new(Inner::default()),
        }
    }

    /// `id` のキー。無ければ空文字列。
    ///
    /// ストアを読めなくても空として扱う(キー不要のローカルサーバーに繋げなくなるのを避ける)。
    /// ただし、書き込みに失敗してメモリに残しているキーは、それを返す。
    pub fn get(&self, id: &str) -> String {
        let mut inner = self.lock();
        self.ensure_loaded(&mut inner, id);
        inner.keys.get(id).cloned().unwrap_or_default()
    }

    pub fn status(&self, id: &str) -> KeyStatus {
        let mut inner = self.lock();
        self.ensure_loaded(&mut inner, id);
        if inner.unsaved.contains(id) {
            self.write(&mut inner, id);
        }
        status_of(&inner, id)
    }

    /// キーを設定する(前後の空白は除く。空なら削除)。ストアに書いたあとの状態を返す。
    pub fn set(&self, id: &str, key: &str) -> KeyStatus {
        let mut inner = self.lock();
        let key = key.trim();
        if key.is_empty() {
            inner.keys.remove(id);
        } else {
            inner.keys.insert(id.to_owned(), key.to_owned());
        }
        inner.loaded.insert(id.to_owned());
        self.write(&mut inner, id);
        status_of(&inner, id)
    }

    /// キーを削除する。
    pub fn clear(&self, id: &str) -> KeyStatus {
        self.set(id, "")
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.inner
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    /// まだ読み込んでいなければ、ストアから読む。読めなかったときは、次回また試す。
    fn ensure_loaded(&self, inner: &mut Inner, id: &str) {
        if inner.loaded.contains(id) {
            return;
        }
        match self.store.get(&api_key_account(id)) {
            Ok(Some(key)) if !key.trim().is_empty() => {
                inner.keys.insert(id.to_owned(), key.trim().to_owned());
                inner.loaded.insert(id.to_owned());
            }
            Ok(_) => {
                inner.loaded.insert(id.to_owned());
            }
            Err(_) => {}
        }
    }

    fn write(&self, inner: &mut Inner, id: &str) {
        let current = inner.keys.get(id).map_or("", String::as_str);
        match put_or_delete(self.store.as_ref(), &api_key_account(id), current) {
            Ok(()) => {
                inner.unsaved.remove(id);
            }
            Err(_) => {
                inner.unsaved.insert(id.to_owned());
            }
        }
    }
}

fn status_of(inner: &Inner, id: &str) -> KeyStatus {
    if inner.unsaved.contains(id) {
        KeyStatus::Unsaved
    } else if inner.keys.contains_key(id) {
        KeyStatus::Saved
    } else {
        KeyStatus::Unset
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::secrets::testing::MemoryStore;

    fn keys(store: &MemoryStore) -> ProfileKeys {
        ProfileKeys::new(Arc::new(store.clone()))
    }

    #[test]
    fn account_names_are_per_profile_and_keep_the_old_default() {
        assert_eq!(api_key_account("default"), "profile:default:api_key");
        assert_eq!(api_key_account("abc"), "profile:abc:api_key");
        assert_ne!(api_key_account("a"), api_key_account("b"));
    }

    #[test]
    fn keys_are_stored_per_profile_and_trimmed() {
        let store = MemoryStore::default();
        let keys = keys(&store);

        assert_eq!(keys.set("a", " key-a "), KeyStatus::Saved);
        keys.set("b", "key-b");

        assert_eq!(store.value("profile:a:api_key").as_deref(), Some("key-a"));
        assert_eq!(store.value("profile:b:api_key").as_deref(), Some("key-b"));
        assert_eq!(keys.get("a"), "key-a");
    }

    #[test]
    fn a_stored_key_is_read_lazily() {
        let store = MemoryStore::with("profile:a:api_key", "stored");
        let keys = keys(&store);

        assert_eq!(keys.status("a"), KeyStatus::Saved);
        assert_eq!(keys.get("a"), "stored");
        assert_eq!(keys.status("b"), KeyStatus::Unset);
    }

    #[test]
    fn an_unreadable_store_means_no_key_and_is_retried_later() {
        let store = MemoryStore::with("profile:a:api_key", "stored");
        store.set_failing(true);
        let keys = keys(&store);

        assert_eq!(keys.get("a"), "");
        assert_eq!(keys.status("a"), KeyStatus::Unset);

        store.set_failing(false);
        assert_eq!(keys.get("a"), "stored");
    }

    #[test]
    fn a_blank_key_clears_the_entry() {
        let store = MemoryStore::with("profile:a:api_key", "old");
        let keys = keys(&store);

        assert_eq!(keys.set("a", "   "), KeyStatus::Unset);
        assert_eq!(store.value("profile:a:api_key"), None);
        assert_eq!(keys.get("a"), "");
    }

    #[test]
    fn clear_removes_only_that_profiles_key() {
        let store = MemoryStore::default();
        let keys = keys(&store);
        keys.set("a", "ka");
        keys.set("b", "kb");

        assert_eq!(keys.clear("a"), KeyStatus::Unset);
        assert_eq!(store.value("profile:a:api_key"), None);
        assert_eq!(store.value("profile:b:api_key").as_deref(), Some("kb"));
    }

    #[test]
    fn a_failing_store_keeps_the_new_key_in_memory_as_unsaved() {
        let store = MemoryStore::default();
        store.set_failing(true);
        let keys = keys(&store);

        assert_eq!(keys.set("a", "key"), KeyStatus::Unsaved);
        assert_eq!(keys.get("a"), "key");
        assert_eq!(store.value("profile:a:api_key"), None);
    }

    #[test]
    fn a_failed_clear_stays_unsaved_until_the_store_recovers() {
        let store = MemoryStore::with("profile:a:api_key", "old");
        let keys = keys(&store);
        store.set_failing(true);

        assert_eq!(keys.clear("a"), KeyStatus::Unsaved);
        assert_eq!(keys.get("a"), "");
        assert_eq!(store.value("profile:a:api_key").as_deref(), Some("old"));

        store.set_failing(false);
        assert_eq!(keys.status("a"), KeyStatus::Unset);
        assert_eq!(store.value("profile:a:api_key"), None);
    }

    #[test]
    fn unsaved_keys_are_written_when_the_store_recovers() {
        let store = MemoryStore::default();
        store.set_failing(true);
        let keys = keys(&store);
        keys.set("a", "key");

        store.set_failing(false);
        assert_eq!(keys.status("a"), KeyStatus::Saved);
        assert_eq!(store.value("profile:a:api_key").as_deref(), Some("key"));
    }
}
