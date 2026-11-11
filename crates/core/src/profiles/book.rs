//! プロファイルの一覧と、使用中のプロファイル。

use serde::{Deserialize, Serialize};
use specta::Type;

use super::model::{ConnectionProfile, DEFAULT_PROFILE_ID};
use super::preset::ProfilePreset;
use crate::error::AppError;
use crate::settings::{ConnectionSettings, DEFAULT_MODEL};

/// 保存されたプロファイルの一覧。常に1件以上あり、`active_id` はその中のどれかを指す。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileBook {
    pub profiles: Vec<ConnectionProfile>,
    /// 使用中のプロファイルのID
    pub active_id: String,
}

impl Default for ProfileBook {
    fn default() -> Self {
        let profile = ConnectionProfile {
            id: DEFAULT_PROFILE_ID.to_owned(),
            name: ProfilePreset::Vllm.label().to_owned(),
            base_url: ProfilePreset::Vllm.base_url().to_owned(),
            model: DEFAULT_MODEL.to_owned(),
        };
        Self {
            active_id: profile.id.clone(),
            profiles: vec![profile],
        }
    }
}

impl ProfileBook {
    /// 単一の接続設定から、ID `default` のプロファイルを1件作る。
    ///
    /// 設定ファイルに `profiles` が無い(この機能より前の保存)ときに使う。
    /// IDを `default` にするので、既存のAPIキー(`profile:default:api_key`)がそのまま付く。
    pub fn from_connection(connection: &ConnectionSettings) -> Self {
        let profile = ConnectionProfile {
            id: DEFAULT_PROFILE_ID.to_owned(),
            name: ProfilePreset::name_for_url(&connection.base_url).to_owned(),
            base_url: connection.base_url.clone(),
            model: connection.model.clone(),
        };
        Self {
            active_id: profile.id.clone(),
            profiles: vec![profile],
        }
    }

    pub fn find(&self, id: &str) -> Option<&ConnectionProfile> {
        self.profiles.iter().find(|profile| profile.id == id)
    }

    /// 使用中のプロファイル。
    pub fn active(&self) -> Option<&ConnectionProfile> {
        self.find(&self.active_id)
    }

    /// 読み込んだ内容を整える。空なら初期の1件に、使用中のIDが無効なら先頭にする。
    ///
    /// URLや名前の検査はしない(壊れた保存を、読むこと自体では拒否しない)。
    pub fn normalized(mut self) -> Self {
        if self.profiles.is_empty() {
            return Self::default();
        }
        if self.active().is_none() {
            self.active_id = self.profiles[0].id.clone();
        }
        self
    }

    /// 各プロファイルを検査してから [`normalized`](Self::normalized) する。
    pub fn validated(self) -> Result<Self, AppError> {
        if self.profiles.is_empty() {
            return Ok(Self::default());
        }
        let profiles = self
            .profiles
            .iter()
            .map(ConnectionProfile::validated)
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Self {
            profiles,
            active_id: self.active_id,
        }
        .normalized())
    }

    /// 既存のプロファイルを入力で置き換える。入力は検査済みであること。
    pub fn replace(&mut self, profile: ConnectionProfile) -> Result<(), AppError> {
        match self.profiles.iter_mut().find(|slot| slot.id == profile.id) {
            Some(slot) => {
                *slot = profile;
                Ok(())
            }
            None => Err(AppError::ProfileNotFound),
        }
    }

    /// 末尾に追加する。IDが既にあるときは失敗する。入力は検査済みであること。
    pub fn add(&mut self, profile: ConnectionProfile) -> Result<(), AppError> {
        if self.find(&profile.id).is_some() {
            return Err(AppError::DuplicateProfile);
        }
        self.profiles.push(profile);
        Ok(())
    }

    /// 削除する。最後の1件は削除できない。使用中のものを消したら、先頭のものを使用中にする。
    pub fn remove(&mut self, id: &str) -> Result<(), AppError> {
        let index = self
            .profiles
            .iter()
            .position(|profile| profile.id == id)
            .ok_or(AppError::ProfileNotFound)?;
        if self.profiles.len() == 1 {
            return Err(AppError::LastProfile);
        }
        self.profiles.remove(index);
        if self.active_id == id {
            self.active_id = self.profiles[0].id.clone();
        }
        Ok(())
    }

    /// 使用中のプロファイルを切り替える。
    pub fn set_active(&mut self, id: &str) -> Result<(), AppError> {
        if self.find(id).is_none() {
            return Err(AppError::ProfileNotFound);
        }
        self.active_id = id.to_owned();
        Ok(())
    }

    /// プロファイルのモデルを変え、そのプロファイルを使用中にする。
    ///
    /// 空白だけなら、サーバーの既定(空文字)にする。
    pub fn select_model(&mut self, id: &str, model: Option<&str>) -> Result<(), AppError> {
        let profile = self
            .profiles
            .iter_mut()
            .find(|profile| profile.id == id)
            .ok_or(AppError::ProfileNotFound)?;
        profile.model = model.unwrap_or("").trim().to_owned();
        self.active_id = id.to_owned();
        Ok(())
    }

    /// 名前が既存のものと重ならないようにする(重なるときは「 2」「 3」…を付ける)。
    pub fn unique_name(&self, base: &str) -> String {
        let taken = |name: &str| self.profiles.iter().any(|profile| profile.name == name);
        if !taken(base) {
            return base.to_owned();
        }
        (2..)
            .map(|n| format!("{base} {n}"))
            .find(|name| !taken(name))
            .expect("いつかは空きが見つかる")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(id: &str) -> ConnectionProfile {
        ConnectionProfile {
            id: id.into(),
            name: id.into(),
            base_url: "http://localhost:8000/v1".into(),
            model: DEFAULT_MODEL.into(),
        }
    }

    fn book_of(ids: &[&str], active: &str) -> ProfileBook {
        ProfileBook {
            profiles: ids.iter().copied().map(profile).collect(),
            active_id: active.into(),
        }
    }

    #[test]
    fn the_default_book_points_at_vllm_and_the_translate_model() {
        let book = ProfileBook::default();
        let active = book.active().unwrap();
        assert_eq!(book.profiles.len(), 1);
        assert_eq!(active.id, DEFAULT_PROFILE_ID);
        assert_eq!(active.name, "vLLM");
        assert_eq!(active.base_url, "http://localhost:8000/v1");
        assert_eq!(active.model, DEFAULT_MODEL);
    }

    #[test]
    fn a_single_connection_becomes_the_default_profile() {
        let book = ProfileBook::from_connection(&ConnectionSettings {
            base_url: "http://localhost:1234/v1".into(),
            model: "m".into(),
        });
        let active = book.active().unwrap();
        assert_eq!(active.id, DEFAULT_PROFILE_ID);
        assert_eq!(active.name, "LM Studio");
        assert_eq!(active.base_url, "http://localhost:1234/v1");
        assert_eq!(active.model, "m");
    }

    #[test]
    fn an_empty_book_is_replaced_by_the_default() {
        let book = ProfileBook {
            profiles: vec![],
            active_id: "x".into(),
        };
        assert_eq!(book.normalized(), ProfileBook::default());
    }

    #[test]
    fn an_unknown_active_id_falls_back_to_the_first_profile() {
        let book = book_of(&["a", "b"], "gone");
        assert_eq!(book.normalized().active_id, "a");
    }

    #[test]
    fn replace_updates_the_matching_profile_only() {
        let mut book = book_of(&["a", "b"], "a");
        book.replace(ConnectionProfile {
            name: "変更".into(),
            ..profile("b")
        })
        .unwrap();
        assert_eq!(book.find("b").unwrap().name, "変更");
        assert_eq!(book.find("a").unwrap().name, "a");
    }

    #[test]
    fn replacing_an_unknown_profile_is_not_found() {
        let mut book = ProfileBook::default();
        assert_eq!(
            book.replace(profile("nope")).unwrap_err(),
            AppError::ProfileNotFound
        );
    }

    #[test]
    fn add_appends_and_rejects_a_duplicate_id() {
        let mut book = book_of(&["a"], "a");
        book.add(profile("b")).unwrap();
        assert_eq!(book.profiles.len(), 2);
        assert_eq!(book.active_id, "a");
        assert_eq!(
            book.add(profile("b")).unwrap_err(),
            AppError::DuplicateProfile
        );
    }

    #[test]
    fn removing_the_active_profile_activates_the_first_one() {
        let mut book = book_of(&["a", "b", "c"], "c");
        book.remove("c").unwrap();
        assert_eq!(book.active_id, "a");
        assert!(book.find("c").is_none());
    }

    #[test]
    fn the_last_profile_and_unknown_ids_cannot_be_removed() {
        let mut book = book_of(&["a"], "a");
        assert_eq!(book.remove("a").unwrap_err(), AppError::LastProfile);
        assert_eq!(book.profiles.len(), 1);
        assert_eq!(
            book_of(&["a", "b"], "a").remove("x").unwrap_err(),
            AppError::ProfileNotFound
        );
    }

    #[test]
    fn selecting_a_model_also_activates_its_profile() {
        let mut book = book_of(&["a", "b"], "a");
        book.select_model("b", Some("  qwen ")).unwrap();
        assert_eq!(book.active_id, "b");
        assert_eq!(book.find("b").unwrap().model, "qwen");
        book.select_model("b", Some("  ")).unwrap();
        assert_eq!(book.find("b").unwrap().model, "");
        assert_eq!(
            book.select_model("x", Some("m")).unwrap_err(),
            AppError::ProfileNotFound
        );
    }

    #[test]
    fn names_are_made_unique_with_a_number() {
        let mut book = book_of(&["a"], "a");
        book.profiles[0].name = "Ollama".into();
        assert_eq!(book.unique_name("vLLM"), "vLLM");
        assert_eq!(book.unique_name("Ollama"), "Ollama 2");
    }
}
