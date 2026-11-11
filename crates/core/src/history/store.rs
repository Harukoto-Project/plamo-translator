//! 履歴のファイルの読み書き。1翻訳 = 1ファイル(`<id>.json`)。
//!
//! 書き込みは一時ファイル経由のアトミック書き込み。versionの方針:
//! 後方互換の追加ではversionを上げず、読めない変更のときだけ上げる。
//! **新しいversionのファイルは読まず、上書きもしない**。壊れたファイルも上書きしない。

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::de::DeserializeOwned;

use super::id::is_valid_id;
use super::model::{
    HISTORY_VERSION, HistoryEntry, HistoryFile, HistoryListing, HistorySummary, MetaFile,
    SaveHistory,
};
use super::title::{derive_title, normalize_title};
use crate::error::AppError;
use crate::fs::write_atomic;

/// 履歴の保存先。読み込みと保存の間に他の書き込みが入らないよう直列化する。
pub struct HistoryStore {
    dir: PathBuf,
    lock: Mutex<()>,
}

/// ファイルを読めなかった理由。
enum ReadError {
    NotFound,
    /// このアプリより新しいversion
    Newer(u64),
    Broken,
    Io(std::io::Error),
}

impl ReadError {
    fn into_app_error(self) -> AppError {
        match self {
            Self::NotFound => AppError::HistoryNotFound,
            Self::Newer(version) => AppError::HistoryVersionUnsupported {
                version: u32::try_from(version).unwrap_or(u32::MAX),
            },
            Self::Broken => AppError::HistoryBroken,
            Self::Io(error) => AppError::HistoryReadFailed {
                detail: error.to_string(),
            },
        }
    }
}

impl HistoryStore {
    /// `dir` は履歴を置くディレクトリ(例: アプリのデータディレクトリの `history`)。
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        Self {
            dir: dir.into(),
            lock: Mutex::new(()),
        }
    }

    /// 履歴の一覧(更新が新しい順)。原文と訳文は読まない。
    ///
    /// 壊れている、または新しいversionのファイルは一覧に入れず、`skipped` に数える。
    pub fn list(&self) -> Result<HistoryListing, AppError> {
        let _guard = self.guard();
        let entries = match fs::read_dir(&self.dir) {
            Ok(entries) => entries,
            Err(error) if error.kind() == ErrorKind::NotFound => {
                return Ok(HistoryListing {
                    entries: Vec::new(),
                    skipped: 0,
                });
            }
            Err(error) => {
                return Err(AppError::HistoryReadFailed {
                    detail: error.to_string(),
                });
            }
        };

        let mut summaries = Vec::new();
        let mut skipped = 0;
        for entry in entries.flatten() {
            let path = entry.path();
            // 履歴のファイルは `<有効なID>.json` だけ。一時ファイルなどは対象外
            let Some(id) = path
                .file_name()
                .and_then(|name| name.to_str())
                .and_then(|name| name.strip_suffix(".json"))
                .filter(|id| is_valid_id(id))
                .map(str::to_owned)
            else {
                continue;
            };
            match read_json::<MetaFile>(&path) {
                Ok(meta) => summaries.push(HistorySummary {
                    id,
                    title: meta.title,
                    created_at: meta.created_at,
                    updated_at: meta.updated_at,
                }),
                Err(_) => skipped += 1,
            }
        }
        summaries.sort_by(|a, b| {
            b.updated_at
                .cmp(&a.updated_at)
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(HistoryListing {
            entries: summaries,
            skipped,
        })
    }

    /// 履歴1件。
    pub fn load(&self, id: &str) -> Result<HistoryEntry, AppError> {
        let path = self.path_for(id)?;
        let _guard = self.guard();
        let file: HistoryFile = read_json(&path).map_err(ReadError::into_app_error)?;
        Ok(entry_from(id, file))
    }

    /// 翻訳を保存する。`now` はUNIX秒。
    ///
    /// 新しい履歴ならタイトルを原文から作る。同じIDが既にあれば、タイトルと作成日時は変えず、
    /// 本文と更新日時だけを置き換える(完了の保存が二重に走っても、ファイルは1つのまま)。
    /// 原文か訳文が空白だけなら、何も保存せず `None`。
    pub fn save(&self, entry: SaveHistory, now: u32) -> Result<Option<HistorySummary>, AppError> {
        let path = self.path_for(&entry.id)?;
        if entry.source_text.trim().is_empty() || entry.target_text.trim().is_empty() {
            return Ok(None);
        }

        let _guard = self.guard();
        let (title, created_at) = match read_json::<MetaFile>(&path) {
            Ok(meta) => (meta.title, meta.created_at),
            Err(ReadError::NotFound) => {
                let title = derive_title(&entry.source_text);
                if title.is_empty() {
                    return Ok(None);
                }
                (title, now)
            }
            Err(other) => return Err(other.into_app_error()),
        };
        let file = HistoryFile {
            version: HISTORY_VERSION,
            id: entry.id.clone(),
            title,
            created_at,
            updated_at: now.max(created_at),
            source_lang: entry.source_lang,
            target_lang: entry.target_lang,
            source_text: entry.source_text,
            target_text: entry.target_text,
            model: entry.model.trim().to_owned(),
        };
        write_file(&path, &file)?;
        Ok(Some(summary(&entry.id, &file)))
    }

    /// 名前を変える。本文と更新日時は変えない(一覧の並びが動かないように)。
    pub fn rename(&self, id: &str, title: &str) -> Result<HistorySummary, AppError> {
        let path = self.path_for(id)?;
        let title = normalize_title(title)?;

        let _guard = self.guard();
        let mut file: HistoryFile = read_json(&path).map_err(ReadError::into_app_error)?;
        file.version = HISTORY_VERSION;
        file.id = id.to_owned();
        file.title = title;
        write_file(&path, &file)?;
        Ok(summary(id, &file))
    }

    /// 履歴を削除する。すでに無ければ何もしない。
    pub fn delete(&self, id: &str) -> Result<(), AppError> {
        let path = self.path_for(id)?;
        let _guard = self.guard();
        match fs::remove_file(&path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
            Err(error) => Err(AppError::HistoryDeleteFailed {
                detail: error.to_string(),
            }),
        }
    }

    /// IDからファイルの場所を決める。ファイル名に使えるIDだけを許す(パスの区切りなどを通さない)。
    fn path_for(&self, id: &str) -> Result<PathBuf, AppError> {
        if !is_valid_id(id) {
            return Err(AppError::InvalidHistoryId);
        }
        Ok(self.dir.join(format!("{id}.json")))
    }

    fn guard(&self) -> std::sync::MutexGuard<'_, ()> {
        // ロック中にpanicしても、ファイルは壊れない(アトミック書き込み)ので続行してよい
        self.lock
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }
}

fn summary(id: &str, file: &HistoryFile) -> HistorySummary {
    HistorySummary {
        id: id.to_owned(),
        title: file.title.clone(),
        created_at: file.created_at,
        updated_at: file.updated_at,
    }
}

fn entry_from(id: &str, file: HistoryFile) -> HistoryEntry {
    HistoryEntry {
        id: id.to_owned(),
        title: file.title,
        created_at: file.created_at,
        updated_at: file.updated_at,
        source_lang: file.source_lang,
        target_lang: file.target_lang,
        source_text: file.source_text,
        target_text: file.target_text,
        model: file.model,
    }
}

/// ファイルを読み、versionを確かめてから `T` として解釈する。
fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T, ReadError> {
    #[derive(serde::Deserialize)]
    struct Probe {
        version: u64,
    }

    let text = fs::read_to_string(path).map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            ReadError::NotFound
        } else {
            ReadError::Io(error)
        }
    })?;
    let probe: Probe = serde_json::from_str(&text).map_err(|_| ReadError::Broken)?;
    if probe.version > u64::from(HISTORY_VERSION) {
        return Err(ReadError::Newer(probe.version));
    }
    serde_json::from_str(&text).map_err(|_| ReadError::Broken)
}

fn write_file(path: &Path, file: &HistoryFile) -> Result<(), AppError> {
    let bytes = serde_json::to_vec_pretty(file)
        .map_err(|error| AppError::internal(format!("履歴を書き出せませんでした: {error}")))?;
    write_atomic(path, &bytes).map_err(|error| AppError::HistoryWriteFailed {
        detail: error.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::translate::Lang;

    fn entry(id: &str, source: &str, target: &str) -> SaveHistory {
        SaveHistory {
            id: id.to_owned(),
            source_lang: Lang::Ja,
            target_lang: Lang::En,
            source_text: source.to_owned(),
            target_text: target.to_owned(),
            model: " pfnet/plamo-2-translate ".to_owned(),
        }
    }

    fn store(dir: &Path) -> HistoryStore {
        HistoryStore::new(dir.join("history"))
    }

    fn file(dir: &Path, id: &str) -> PathBuf {
        dir.join("history").join(format!("{id}.json"))
    }

    #[test]
    fn a_finished_translation_is_saved_with_a_title_and_read_back() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());

        let saved = history
            .save(
                entry("c1", "今日はいい天気ですね。", "It's nice today."),
                1000,
            )
            .unwrap()
            .unwrap();

        assert_eq!(
            saved,
            HistorySummary {
                id: "c1".into(),
                title: "今日はいい天気ですね。".into(),
                created_at: 1000,
                updated_at: 1000,
            }
        );
        let loaded = history.load("c1").unwrap();
        assert_eq!(loaded.source_text, "今日はいい天気ですね。");
        assert_eq!(loaded.target_text, "It's nice today.");
        assert_eq!(loaded.source_lang, Lang::Ja);
        assert_eq!(loaded.target_lang, Lang::En);
        assert_eq!(loaded.model, "pfnet/plamo-2-translate");
        assert_eq!(history.list().unwrap().entries, vec![saved]);
    }

    #[test]
    fn the_file_has_only_the_expected_fields_and_a_version() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        history.save(entry("c1", "こんにちは", "Hello"), 1).unwrap();

        let text = fs::read_to_string(file(dir.path(), "c1")).unwrap();
        let value: serde_json::Value = serde_json::from_str(&text).unwrap();
        let mut keys: Vec<_> = value.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        // URL・APIキー・プロファイル名は保存しない
        assert_eq!(
            keys,
            [
                "createdAt",
                "id",
                "model",
                "sourceLang",
                "sourceText",
                "targetLang",
                "targetText",
                "title",
                "updatedAt",
                "version",
            ]
        );
        assert_eq!(value["version"], 1);
        assert_eq!(value["sourceLang"], "ja");
        assert!(value.get("baseUrl").is_none());
        assert!(value.get("apiKey").is_none());
        assert!(value.get("profileName").is_none());
    }

    #[test]
    fn a_blank_translation_is_not_saved() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());

        assert_eq!(history.save(entry("c1", "  \n", "Hello"), 1).unwrap(), None);
        assert_eq!(
            history.save(entry("c1", "こんにちは", "  "), 1).unwrap(),
            None
        );
        assert!(!dir.path().join("history").exists());
    }

    #[test]
    fn saving_the_same_id_again_keeps_the_title_and_creation_time() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        history
            .save(entry("c1", "最初の原文", "First"), 1000)
            .unwrap();
        history.rename("c1", "名前を付けた").unwrap();

        let saved = history
            .save(entry("c1", "最初の原文を直した", "Second"), 2000)
            .unwrap()
            .unwrap();

        assert_eq!(saved.title, "名前を付けた");
        assert_eq!(saved.created_at, 1000);
        assert_eq!(saved.updated_at, 2000);
        assert_eq!(history.load("c1").unwrap().target_text, "Second");
    }

    #[test]
    fn the_update_time_never_goes_before_the_creation_time() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        history.save(entry("c1", "原文", "訳"), 2000).unwrap();

        let saved = history
            .save(entry("c1", "原文", "訳"), 1000)
            .unwrap()
            .unwrap();

        assert_eq!(saved.updated_at, 2000);
    }

    #[test]
    fn rename_changes_only_the_title() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        history.save(entry("c1", "原文", "訳"), 1000).unwrap();

        let renamed = history.rename("c1", "  新しい  名前 ").unwrap();

        assert_eq!(renamed.title, "新しい 名前");
        assert_eq!(renamed.updated_at, 1000);
        let loaded = history.load("c1").unwrap();
        assert_eq!(loaded.source_text, "原文");
        assert_eq!(loaded.target_text, "訳");
    }

    #[test]
    fn rename_rejects_bad_input_and_unknown_entries() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        history.save(entry("c1", "原文", "訳"), 1).unwrap();

        assert_eq!(
            history.rename("c1", "  ").unwrap_err(),
            AppError::HistoryTitleEmpty
        );
        assert_eq!(
            history.rename("missing", "x").unwrap_err(),
            AppError::HistoryNotFound
        );
        assert_eq!(history.load("c1").unwrap().title, "原文");
    }

    #[test]
    fn delete_removes_the_file_and_is_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        history.save(entry("c1", "あ", "a"), 1).unwrap();
        history.save(entry("c2", "い", "b"), 2).unwrap();

        history.delete("c1").unwrap();
        history.delete("c1").unwrap();

        let ids: Vec<_> = history
            .list()
            .unwrap()
            .entries
            .into_iter()
            .map(|item| item.id)
            .collect();
        assert_eq!(ids, ["c2"]);
        assert_eq!(history.load("c1").unwrap_err(), AppError::HistoryNotFound);
    }

    #[test]
    fn ids_that_are_not_file_name_safe_are_rejected_everywhere() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        for id in ["../x", "a/b", "a b", "", "日本語", &"a".repeat(65)] {
            assert_eq!(history.load(id).unwrap_err(), AppError::InvalidHistoryId);
            assert_eq!(
                history.save(entry(id, "あ", "a"), 1).unwrap_err(),
                AppError::InvalidHistoryId
            );
            assert_eq!(
                history.rename(id, "x").unwrap_err(),
                AppError::InvalidHistoryId
            );
            assert_eq!(history.delete(id).unwrap_err(), AppError::InvalidHistoryId);
        }
        assert!(!dir.path().join("x.json").exists());
    }

    #[test]
    fn the_list_is_newest_first_and_a_missing_directory_is_empty() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        assert_eq!(history.list().unwrap().entries, vec![]);

        history.save(entry("old", "古い", "old"), 1000).unwrap();
        history.save(entry("new", "新しい", "new"), 3000).unwrap();
        history.save(entry("mid", "中間", "mid"), 2000).unwrap();

        let ids: Vec<_> = history
            .list()
            .unwrap()
            .entries
            .into_iter()
            .map(|item| item.id)
            .collect();
        assert_eq!(ids, ["new", "mid", "old"]);
    }

    #[test]
    fn broken_and_newer_files_are_skipped_and_left_untouched() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        history.save(entry("ok", "あ", "a"), 1).unwrap();
        let broken = "{ broken";
        let newer = r#"{"version":2,"title":"x","createdAt":1,"updatedAt":1}"#;
        fs::write(file(dir.path(), "broken"), broken).unwrap();
        fs::write(file(dir.path(), "newer"), newer).unwrap();
        fs::write(dir.path().join("history").join("ok.json.tmp"), "x").unwrap();
        fs::write(dir.path().join("history").join("notes.txt"), "x").unwrap();
        fs::write(dir.path().join("history").join("a b.json"), "x").unwrap();

        let listing = history.list().unwrap();

        assert_eq!(listing.entries.len(), 1);
        assert_eq!(listing.skipped, 2);
        assert_eq!(
            fs::read_to_string(file(dir.path(), "broken")).unwrap(),
            broken
        );
        assert_eq!(
            fs::read_to_string(file(dir.path(), "newer")).unwrap(),
            newer
        );
    }

    #[test]
    fn a_newer_version_is_refused_and_never_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        let newer = r#"{"version":2,"title":"x"}"#;
        fs::create_dir_all(dir.path().join("history")).unwrap();
        fs::write(file(dir.path(), "c1"), newer).unwrap();

        assert_eq!(
            history.load("c1").unwrap_err(),
            AppError::HistoryVersionUnsupported { version: 2 }
        );
        assert!(history.save(entry("c1", "あ", "a"), 5).is_err());
        assert!(history.rename("c1", "x").is_err());
        assert_eq!(fs::read_to_string(file(dir.path(), "c1")).unwrap(), newer);
    }

    #[test]
    fn a_broken_file_is_refused_and_never_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        fs::create_dir_all(dir.path().join("history")).unwrap();
        fs::write(file(dir.path(), "c1"), "{ broken").unwrap();

        assert_eq!(history.load("c1").unwrap_err(), AppError::HistoryBroken);
        assert!(history.save(entry("c1", "あ", "a"), 5).is_err());
        assert!(history.rename("c1", "x").is_err());
        assert_eq!(
            fs::read_to_string(file(dir.path(), "c1")).unwrap(),
            "{ broken"
        );
    }

    #[test]
    fn the_file_name_wins_over_the_id_inside_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        fs::create_dir_all(dir.path().join("history")).unwrap();
        fs::write(
            file(dir.path(), "c1"),
            r#"{"version":1,"id":"other","title":"t","createdAt":1,"updatedAt":2,"sourceLang":"en","targetLang":"ja","sourceText":"Hi","targetText":"やあ","model":"m"}"#,
        )
        .unwrap();

        assert_eq!(history.load("c1").unwrap().id, "c1");
        assert_eq!(history.list().unwrap().entries[0].id, "c1");
    }

    #[test]
    fn unknown_extra_fields_in_the_current_version_are_tolerated() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        fs::create_dir_all(dir.path().join("history")).unwrap();
        fs::write(
            file(dir.path(), "c1"),
            r#"{"version":1,"id":"c1","future":1,"title":"t","createdAt":1,"updatedAt":2,"sourceLang":"ko","targetLang":"ja","sourceText":"안녕","targetText":"こんにちは","model":""}"#,
        )
        .unwrap();

        let loaded = history.load("c1").unwrap();
        assert_eq!(loaded.title, "t");
        assert_eq!(loaded.source_lang, Lang::Ko);
        assert_eq!(history.list().unwrap().entries.len(), 1);
    }

    #[test]
    fn a_failed_write_keeps_the_previous_version() {
        let dir = tempfile::tempdir().unwrap();
        let history = store(dir.path());
        history.save(entry("c1", "元", "old"), 1).unwrap();
        fs::create_dir(dir.path().join("history").join("c1.json.tmp")).unwrap();

        assert!(history.save(entry("c1", "新", "new"), 2).is_err());

        assert_eq!(history.load("c1").unwrap().source_text, "元");
    }
}
