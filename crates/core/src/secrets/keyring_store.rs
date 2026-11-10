//! `keyring` クレートによる [`SecretStore`]。
//!
//! 既定の `v1` 機能で、初回の利用時にプラットフォームのストアが選ばれる:
//! Windowsの資格情報マネージャー、macOSのキーチェーン、その他のUnixのSecret Service。

use super::{SERVICE, SecretError, SecretStore};

pub struct KeyringStore;

impl KeyringStore {
    fn entry(account: &str) -> Result<keyring::Entry, SecretError> {
        keyring::Entry::new(SERVICE, account).map_err(describe)
    }
}

impl SecretStore for KeyringStore {
    fn get(&self, account: &str) -> Result<Option<String>, SecretError> {
        match Self::entry(account)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(describe(error)),
        }
    }

    fn set(&self, account: &str, secret: &str) -> Result<(), SecretError> {
        Self::entry(account)?.set_password(secret).map_err(describe)
    }

    fn delete(&self, account: &str) -> Result<(), SecretError> {
        match Self::entry(account)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(describe(error)),
        }
    }
}

fn describe(error: keyring::Error) -> SecretError {
    SecretError(format!("OSの資格情報ストアを利用できません: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 実際のOSのストアでの往復。`cargo test -- --ignored` で実行する。
    #[test]
    #[ignore = "実際のOSの資格情報ストアに触れる"]
    fn round_trip_with_os_store() {
        let account = format!("test-{}", std::process::id());
        let store = KeyringStore;

        assert_eq!(store.get(&account), Ok(None));
        store.set(&account, "value").unwrap();
        assert_eq!(store.get(&account), Ok(Some("value".to_owned())));
        store.delete(&account).unwrap();
        assert_eq!(store.get(&account), Ok(None));
        // 無いものを消してもエラーにならない
        store.delete(&account).unwrap();
    }
}
