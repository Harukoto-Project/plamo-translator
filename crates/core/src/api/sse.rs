//! Server-Sent Events の行の解析。
//!
//! ネットワークのチャンクは行の途中や、UTF-8の文字の途中で切れることがあるため、
//! 改行までバイトのまま溜めてから文字列にする。`data:` の行だけを取り出す。

/// チャンクを受け取り、完成した `data:` 行の中身を返す。
#[derive(Debug, Default)]
pub struct SseLines {
    buffer: Vec<u8>,
}

impl SseLines {
    pub fn new() -> Self {
        Self::default()
    }

    /// バイト列を追加し、新しく完成した `data:` 行の中身(前後の空白なし)を返す。
    pub fn push(&mut self, bytes: &[u8]) -> Vec<String> {
        self.buffer.extend_from_slice(bytes);
        let mut out = Vec::new();
        while let Some(end) = self.buffer.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = self.buffer.drain(..=end).collect();
            if let Some(data) = data_of(&line) {
                out.push(data);
            }
        }
        out
    }

    /// ストリームの終端。改行で終わらなかった最後の行を返す。
    pub fn finish(&mut self) -> Option<String> {
        let line = std::mem::take(&mut self.buffer);
        data_of(&line)
    }
}

fn data_of(line: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(line);
    let text = text.trim_end_matches(['\r', '\n']);
    let data = text.strip_prefix("data:")?.trim();
    (!data.is_empty()).then(|| data.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_data_lines_and_ignores_the_rest() {
        let mut lines = SseLines::new();
        let out =
            lines.push(b": comment\nevent: message\ndata: {\"a\":1}\n\ndata:{\"b\":2}\r\n\r\n");
        assert_eq!(out, [r#"{"a":1}"#, r#"{"b":2}"#]);
    }

    #[test]
    fn joins_lines_split_across_chunks() {
        let mut lines = SseLines::new();
        assert!(lines.push(b"data: {\"te").is_empty());
        assert_eq!(lines.push(b"xt\":1}\n"), [r#"{"text":1}"#]);
    }

    #[test]
    fn keeps_multibyte_characters_split_across_chunks() {
        let bytes = "data: こんにちは\n".as_bytes();
        // 「こ」(3バイト)の途中で分ける
        let (a, b) = bytes.split_at(8);
        let mut lines = SseLines::new();
        assert!(lines.push(a).is_empty());
        assert_eq!(lines.push(b), ["こんにちは"]);
    }

    #[test]
    fn finish_returns_the_last_line_without_a_newline() {
        let mut lines = SseLines::new();
        assert!(lines.push(b"data: [DONE]").is_empty());
        assert_eq!(lines.finish().as_deref(), Some("[DONE]"));
        assert_eq!(lines.finish(), None);
    }

    #[test]
    fn empty_data_lines_are_skipped() {
        let mut lines = SseLines::new();
        assert!(lines.push(b"data:\ndata:   \n").is_empty());
    }
}
