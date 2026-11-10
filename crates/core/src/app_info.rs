//! アプリ自体の情報。

use serde::Serialize;
use specta::Type;

/// フロントに表示するアプリの基本情報。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

impl AppInfo {
    /// 名前とバージョンから作る。
    pub fn new(name: impl Into<String>, version: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            version: version.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_camel_case() {
        let json = serde_json::to_string(&AppInfo::new("plamo-translator", "0.1.0")).unwrap();
        assert_eq!(json, r#"{"name":"plamo-translator","version":"0.1.0"}"#);
    }
}
