//! 履歴のID。ファイル名にそのまま使うので、パスとして解釈される文字は通さない。

/// IDとして使える文字列か(ASCIIの英数字・`-`・`_`、1〜64文字)。
pub(super) fn is_valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_ascii_ids_within_the_limit() {
        assert!(is_valid_id("a"));
        assert!(is_valid_id("3f2b8c1e-5a0d-4b7e-9c11-2d6a8e4f7b90"));
        assert!(is_valid_id(&"a".repeat(64)));
    }

    #[test]
    fn rejects_ids_that_are_not_file_name_safe() {
        for id in [
            "",
            "a/b",
            "../x",
            "a b",
            "日本語",
            "a.json",
            &"a".repeat(65),
        ] {
            assert!(!is_valid_id(id), "{id}");
        }
    }
}
