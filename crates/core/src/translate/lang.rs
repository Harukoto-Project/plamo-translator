//! 翻訳の言語。

use serde::{Deserialize, Serialize};
use specta::Type;

/// 翻訳の言語。`auto`(自動判定)は含めない。画面で解決してからRustに渡す。
///
/// 言語を足すときは、バリアントと [`Lang::plamo_name`] を足す。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Lang {
    Ja,
    En,
    /// 公式の検証範囲外。品質は「そこそこ」(ユーザーが確認済み)
    Ko,
}

impl Lang {
    /// プロンプトの `lang=` に書く、PLaMoの言語名。
    pub fn plamo_name(self) -> &'static str {
        match self {
            Self::Ja => "Japanese",
            Self::En => "English",
            Self::Ko => "Korean",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_to_the_plamo_language_names() {
        assert_eq!(Lang::Ja.plamo_name(), "Japanese");
        assert_eq!(Lang::En.plamo_name(), "English");
        assert_eq!(Lang::Ko.plamo_name(), "Korean");
    }

    #[test]
    fn uses_lowercase_ids_on_the_wire() {
        assert_eq!(serde_json::to_string(&Lang::Ko).unwrap(), r#""ko""#);
        assert_eq!(serde_json::from_str::<Lang>(r#""ja""#).unwrap(), Lang::Ja);
        assert!(serde_json::from_str::<Lang>(r#""auto""#).is_err());
    }
}
