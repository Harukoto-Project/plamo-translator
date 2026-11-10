//! モデルの出力の整形。

/// ストリームで届く訳文の前後の空白を取り除く。
///
/// - 先頭: 最初の空白でない文字まで捨てる。
/// - 末尾: 空白は、次の空白でない文字が届くまで保留する(届かなければ捨てる)。
///   途中の空白・改行は、そのまま通す。
#[derive(Debug, Default)]
pub struct OutputTrimmer {
    started: bool,
    pending: String,
}

impl OutputTrimmer {
    /// 届いたテキストを渡し、画面に出してよい部分を返す(無ければ空文字列)。
    pub fn push(&mut self, text: &str) -> String {
        let text = if self.started {
            text
        } else {
            text.trim_start()
        };
        let body = text.trim_end();
        if body.is_empty() {
            // 空白だけ。先頭の前なら捨て、そうでなければ次の文字が来るまで保留する
            if self.started {
                self.pending.push_str(text);
            }
            return String::new();
        }
        self.started = true;
        let mut out = std::mem::take(&mut self.pending);
        out.push_str(body);
        self.pending.push_str(&text[body.len()..]);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(chunks: &[&str]) -> String {
        let mut trimmer = OutputTrimmer::default();
        chunks.iter().map(|chunk| trimmer.push(chunk)).collect()
    }

    #[test]
    fn leaves_plain_text_alone() {
        assert_eq!(run(&["Hello", ", ", "world"]), "Hello, world");
    }

    #[test]
    fn drops_leading_whitespace_across_chunks() {
        assert_eq!(run(&["\n", "  ", "\n\nこん", "にちは"]), "こんにちは");
    }

    #[test]
    fn drops_trailing_whitespace_at_the_end() {
        assert_eq!(run(&["abc", "\n", "\n"]), "abc");
        assert_eq!(run(&["abc  \n"]), "abc");
    }

    #[test]
    fn holds_trailing_whitespace_until_more_text_arrives() {
        let mut trimmer = OutputTrimmer::default();

        assert_eq!(trimmer.push("one"), "one");
        assert_eq!(trimmer.push("\n\n"), "");
        // 保留していた改行が、次の文字といっしょに出る
        assert_eq!(trimmer.push("two"), "\n\ntwo");
    }

    #[test]
    fn keeps_whitespace_between_words_and_lines() {
        assert_eq!(run(&["a b", "\n", "c\n"]), "a b\nc");
    }

    #[test]
    fn whitespace_only_output_is_empty() {
        assert_eq!(run(&["", " ", "\n"]), "");
    }

    #[test]
    fn handles_multibyte_whitespace() {
        // 全角スペースも空白として扱う
        assert_eq!(run(&["\u{3000}あ", "\u{3000}"]), "あ");
    }
}
