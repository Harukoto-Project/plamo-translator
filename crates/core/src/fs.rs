//! ファイル書き込みの共通処理。

use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

/// 一時ファイルに書いてから置き換える(アトミック書き込み)。
///
/// 失敗したら一時ファイルを消し、直前の版をそのまま残す。
pub fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent)?;

    let mut temp_name = path.file_name().unwrap_or_default().to_os_string();
    temp_name.push(".tmp");
    let temp = parent.join(temp_name);

    let result = (|| {
        let mut file = File::create(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temp, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_parent_directories_and_writes_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a").join("b.json");

        write_atomic(&path, b"hello").unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"hello");
    }

    #[test]
    fn replaces_an_existing_file_and_leaves_no_temp_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.json");
        write_atomic(&path, b"old").unwrap();

        write_atomic(&path, b"new").unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"new");
        let names: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(names, ["a.json"]);
    }

    #[test]
    fn failure_keeps_the_previous_file_and_removes_the_temp_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.json");
        write_atomic(&path, b"old").unwrap();
        // 置き換え先がディレクトリだとリネームに失敗する
        let blocked = dir.path().join("blocked");
        fs::create_dir(&blocked).unwrap();

        assert!(write_atomic(&blocked, b"new").is_err());

        assert_eq!(fs::read(&path).unwrap(), b"old");
        assert!(!dir.path().join("blocked.tmp").exists());
    }
}
