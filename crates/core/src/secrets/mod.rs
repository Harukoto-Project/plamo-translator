//! OSの資格情報ストアによる秘密情報の保存。
//!
//! APIキーなどの秘密情報は、設定ファイルや履歴に書かず、必ず [`SecretStore`] を通す。
//! 本番の実装は [`KeyringStore`]。テストではメモリ上の代用品を使う。

mod api_key;
mod keyring_store;

use std::fmt;

pub use api_key::{API_KEY_ACCOUNT, KeyStatus, clear_key, key_status, read_key, set_key};
pub use keyring_store::KeyringStore;

/// 資格情報ストアのサービス名。アカウント名は秘密情報の持ち主が決める(→ [`API_KEY_ACCOUNT`])。
pub const SERVICE: &str = "plamo-translator";

/// 資格情報ストアの失敗。OSが返したメッセージを持つ。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecretError(pub String);

impl fmt::Display for SecretError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for SecretError {}

/// 名前を付けて秘密情報を保存する場所。
pub trait SecretStore: Send + Sync {
    /// 秘密情報を返す。`account` に何も保存されていなければ `None`。
    fn get(&self, account: &str) -> Result<Option<String>, SecretError>;
    fn set(&self, account: &str, secret: &str) -> Result<(), SecretError>;
    /// 秘密情報を消す。無いものを消してもエラーにしない。
    fn delete(&self, account: &str) -> Result<(), SecretError>;
}

/// `value`(前後の空白を除く)を保存する。空なら削除する。
pub fn put_or_delete(
    store: &dyn SecretStore,
    account: &str,
    value: &str,
) -> Result<(), SecretError> {
    match value.trim() {
        "" => store.delete(account),
        secret => store.set(account, secret),
    }
}

#[cfg(test)]
pub mod testing {
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    use super::{SecretError, SecretStore};

    /// メモリ上のストア。`Box` に入れたあとでも、中身と失敗モードを外から確認できる。
    #[derive(Clone, Default)]
    pub struct MemoryStore {
        entries: Arc<Mutex<HashMap<String, String>>>,
        fail: Arc<Mutex<bool>>,
    }

    impl MemoryStore {
        pub fn with(account: &str, secret: &str) -> Self {
            let store = Self::default();
            store
                .entries
                .lock()
                .unwrap()
                .insert(account.to_owned(), secret.to_owned());
            store
        }

        pub fn set_failing(&self, failing: bool) {
            *self.fail.lock().unwrap() = failing;
        }

        pub fn value(&self, account: &str) -> Option<String> {
            self.entries.lock().unwrap().get(account).cloned()
        }

        fn check(&self) -> Result<(), SecretError> {
            if *self.fail.lock().unwrap() {
                Err(SecretError("store unavailable".into()))
            } else {
                Ok(())
            }
        }
    }

    impl SecretStore for MemoryStore {
        fn get(&self, account: &str) -> Result<Option<String>, SecretError> {
            self.check()?;
            Ok(self.value(account))
        }

        fn set(&self, account: &str, secret: &str) -> Result<(), SecretError> {
            self.check()?;
            self.entries
                .lock()
                .unwrap()
                .insert(account.to_owned(), secret.to_owned());
            Ok(())
        }

        fn delete(&self, account: &str) -> Result<(), SecretError> {
            self.check()?;
            self.entries.lock().unwrap().remove(account);
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::testing::MemoryStore;
    use super::*;

    #[test]
    fn put_stores_the_trimmed_secret() {
        let store = MemoryStore::default();
        put_or_delete(&store, "a", "  key  ").unwrap();
        assert_eq!(store.value("a").as_deref(), Some("key"));
    }

    #[test]
    fn a_blank_value_deletes_the_entry() {
        let store = MemoryStore::with("a", "key");
        put_or_delete(&store, "a", "   ").unwrap();
        assert_eq!(store.value("a"), None);
        // もう一度消してもエラーにならない
        put_or_delete(&store, "a", "").unwrap();
    }

    #[test]
    fn store_errors_are_propagated() {
        let store = MemoryStore::default();
        store.set_failing(true);
        assert!(put_or_delete(&store, "a", "key").is_err());
    }
}
