//! 履歴のタイトル。純粋関数だけを置く。AIには作らせない。

use crate::error::AppError;

/// 自動で付けるタイトルの最大文字数(これを超えたら `…` を付けて切る)。
const AUTO_TITLE_CHARS: usize = 30;
/// 名前を変えるときの最大文字数。
pub(super) const MAX_TITLE_CHARS: usize = 100;

/// 原文の先頭から作る。空白(改行を含む)は1つの空白にまとめ、長ければ切る。
/// 空白しか無いときは空文字を返す(呼び出し側は保存しない)。
pub(super) fn derive_title(source: &str) -> String {
    shorten(&collapse_whitespace(source))
}

/// 空白を整えたあとの文字列を、長ければ切って `…` を付ける。
fn shorten(collapsed: &str) -> String {
    if collapsed.chars().count() <= AUTO_TITLE_CHARS {
        return collapsed.to_owned();
    }
    let mut title: String = collapsed.chars().take(AUTO_TITLE_CHARS).collect();
    title.truncate(title.trim_end().len());
    title.push('…');
    title
}

/// 名前変更の入力を検査して整える(前後の空白を除き、改行などを空白1つにする)。
pub(super) fn normalize_title(input: &str) -> Result<String, AppError> {
    let title = collapse_whitespace(input);
    if title.is_empty() {
        return Err(AppError::HistoryTitleEmpty);
    }
    if title.chars().count() > MAX_TITLE_CHARS {
        return Err(AppError::HistoryTitleTooLong {
            max: u32::try_from(MAX_TITLE_CHARS).unwrap_or(u32::MAX),
        });
    }
    Ok(title)
}

fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_title_comes_from_the_source_text() {
        assert_eq!(
            derive_title("今日はいい天気ですね。"),
            "今日はいい天気ですね。"
        );
    }

    #[test]
    fn whitespace_and_newlines_are_collapsed() {
        assert_eq!(derive_title("  こんにちは \n\n 世界\t"), "こんにちは 世界");
    }

    #[test]
    fn long_titles_are_cut_with_an_ellipsis() {
        let exactly = "あ".repeat(30);
        assert_eq!(derive_title(&exactly), exactly);

        let long = "あ".repeat(31);
        assert_eq!(derive_title(&long), format!("{}…", "あ".repeat(30)));
    }

    #[test]
    fn a_trailing_space_is_not_left_before_the_ellipsis() {
        let text = format!("{} {}", "a".repeat(29), "b".repeat(10));
        assert_eq!(derive_title(&text), format!("{}…", "a".repeat(29)));
    }

    #[test]
    fn blank_source_has_no_title() {
        assert_eq!(derive_title("  \n "), "");
    }

    #[test]
    fn a_rename_is_trimmed_and_collapsed() {
        assert_eq!(normalize_title("  旅行の  計画\n").unwrap(), "旅行の 計画");
    }

    #[test]
    fn blank_and_too_long_names_are_rejected() {
        assert_eq!(
            normalize_title("  ").unwrap_err(),
            AppError::HistoryTitleEmpty
        );
        assert!(normalize_title(&"あ".repeat(100)).is_ok());
        assert_eq!(
            normalize_title(&"あ".repeat(101)).unwrap_err(),
            AppError::HistoryTitleTooLong { max: 100 }
        );
    }
}
