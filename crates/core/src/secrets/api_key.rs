//! 接続先のAPIキー。OSの資格情報ストアに保存する。
//!
//! **キーの値をフロントへ返す経路は作らない。** フロントが知れるのは、キーの有無([`KeyStatus`])だけ。
//! キーは任意(キー不要のローカルサーバーが多い)。

use serde::Serialize;
use specta::Type;

use super::{SecretError, SecretStore, put_or_delete};
use crate::error::AppError;

/// APIキーを入れるアカウント名。
///
/// 接続プロファイルを複数持てるようにする(④)ときに、`profile:<id>:api_key` の形のまま
/// 既存のキーを引き継げるよう、いまの接続先を `default` というIDのプロファイルとして扱う。
pub const API_KEY_ACCOUNT: &str = "profile:default:api_key";

/// キーの状態。設定画面の表示用。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum KeyStatus {
    /// キーは設定されていない
    Unset,
    /// OSの資格情報ストアに保存されている
    Saved,
}

/// キーの状態。ストアを読めなければエラー。
pub fn key_status(store: &dyn SecretStore) -> Result<KeyStatus, AppError> {
    match store.get(API_KEY_ACCOUNT).map_err(describe)? {
        Some(key) if !key.is_empty() => Ok(KeyStatus::Saved),
        _ => Ok(KeyStatus::Unset),
    }
}

/// キーを保存する(前後の空白は除く。空なら削除)。保存後の状態を返す。
pub fn set_key(store: &dyn SecretStore, value: &str) -> Result<KeyStatus, AppError> {
    put_or_delete(store, API_KEY_ACCOUNT, value).map_err(describe)?;
    key_status(store)
}

/// キーを削除する。
pub fn clear_key(store: &dyn SecretStore) -> Result<KeyStatus, AppError> {
    store.delete(API_KEY_ACCOUNT).map_err(describe)?;
    Ok(KeyStatus::Unset)
}

/// リクエストに使うキー。無ければ、またはストアを読めなければ空文字列。
///
/// ストアを読めなくても空として扱う。キー不要のローカルサーバーに繋げなくなるのを避けるため。
/// (キーが要るサーバーなら、認証エラーとして画面に出る。)
pub fn read_key(store: &dyn SecretStore) -> String {
    store
        .get(API_KEY_ACCOUNT)
        .ok()
        .flatten()
        .unwrap_or_default()
}

fn describe(error: SecretError) -> AppError {
    AppError::Secret { detail: error.0 }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::secrets::testing::MemoryStore;

    #[test]
    fn the_status_follows_what_is_stored() {
        let store = MemoryStore::default();
        assert_eq!(key_status(&store).unwrap(), KeyStatus::Unset);

        assert_eq!(set_key(&store, " sk-1 ").unwrap(), KeyStatus::Saved);
        assert_eq!(store.value(API_KEY_ACCOUNT).as_deref(), Some("sk-1"));
        assert_eq!(read_key(&store), "sk-1");
    }

    #[test]
    fn setting_a_blank_key_removes_it() {
        let store = MemoryStore::with(API_KEY_ACCOUNT, "sk-1");

        assert_eq!(set_key(&store, "  ").unwrap(), KeyStatus::Unset);

        assert_eq!(store.value(API_KEY_ACCOUNT), None);
    }

    #[test]
    fn clearing_removes_the_key_and_is_idempotent() {
        let store = MemoryStore::with(API_KEY_ACCOUNT, "sk-1");

        assert_eq!(clear_key(&store).unwrap(), KeyStatus::Unset);
        assert_eq!(clear_key(&store).unwrap(), KeyStatus::Unset);
        assert_eq!(read_key(&store), "");
    }

    #[test]
    fn a_failing_store_is_an_error_for_the_settings_screen() {
        let store = MemoryStore::default();
        store.set_failing(true);

        assert!(matches!(key_status(&store), Err(AppError::Secret { .. })));
        assert!(matches!(set_key(&store, "k"), Err(AppError::Secret { .. })));
        assert!(matches!(clear_key(&store), Err(AppError::Secret { .. })));
    }

    #[test]
    fn but_a_failing_store_does_not_block_a_translation_without_a_key() {
        let store = MemoryStore::default();
        store.set_failing(true);

        assert_eq!(read_key(&store), "");
    }
}
