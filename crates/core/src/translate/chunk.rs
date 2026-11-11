//! 原文を段落・文単位に分割し、訳文を同じ改行構造で連結する。
//!
//! 通信もプロンプトも知らない純粋関数。翻訳の実行は、ここが返したブロックを順に渡し、
//! 区切りはそのまま訳文の間へ戻す。

/// 分割の結果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChunkPlan {
    /// 翻訳するブロック。中身の無い原文では空。
    pub chunks: Vec<Chunk>,
    /// 最後のブロックの後ろに戻す区切り(末尾の空行など)。
    pub trailing_separator: String,
}

/// 1回の翻訳に渡すブロック。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Chunk {
    /// 訳文の前に、翻訳せず戻す区切り(先頭の空行・ブロックの間の改行)。
    pub separator_before: String,
    /// 翻訳する本文。前後の区切りは含まない。
    pub text: String,
}

/// 原文を、1ブロックが `budget` 文字以内になるように分ける。
///
/// 文字数はUnicodeスカラー値(`char`)で数える。`budget` が 0 のときは 1 として扱う
/// (0のまま割ると、区切りの無い行を無限に分けようとするため)。
///
/// 手順:
/// 1. 空行(改行が2つ以上続くところ)で段落に分ける。区切りの改行はそのまま記録する。
/// 2. 中身が空白だけの段落は翻訳せず、区切りに畳む。
/// 3. 隣り合う段落を、予算に収まる範囲で1つのブロックにまとめる。
/// 4. 1つの段落が予算を超えるときは、文の区切りで分ける。
/// 5. 区切りの無い長い行は、予算の長さで切る。
pub fn split(text: &str, budget: usize) -> ChunkPlan {
    let budget = budget.max(1);
    let (paragraphs, mut trailing) = split_paragraphs(text);
    let mut chunks = Vec::new();
    let mut group: Option<ParagraphGroup> = None;
    // 文の末尾に付いていた空白。次の段落の区切りの前に戻す。
    let mut carry = String::new();

    for mut paragraph in paragraphs {
        if !carry.is_empty() {
            let mut separator = std::mem::take(&mut carry);
            separator.push_str(&paragraph.separator_before);
            paragraph.separator_before = separator;
        }

        if paragraph.text.chars().count() > budget {
            if let Some(finished) = group.take() {
                chunks.push(finished.into_chunk());
            }
            let (mut pieces, leftover) = split_oversized(&paragraph.text, budget);
            if let Some(first) = pieces.first_mut() {
                first
                    .separator_before
                    .insert_str(0, &paragraph.separator_before);
            }
            carry = leftover;
            chunks.extend(pieces);
        } else if let Some(rejected) = push_paragraph(&mut group, paragraph, budget) {
            if let Some(finished) = group.take() {
                chunks.push(finished.into_chunk());
            }
            group = Some(ParagraphGroup::from_paragraph(rejected));
        }
    }

    if let Some(finished) = group {
        chunks.push(finished.into_chunk());
    }
    if !carry.is_empty() {
        trailing.insert_str(0, &carry);
    }

    ChunkPlan {
        chunks,
        trailing_separator: trailing,
    }
}

/// ブロックの訳文を、原文の区切りのままつなぐ。訳文の前後の空白は除く。
///
/// `translations` は `plan.chunks` と同じ順。数が足りないぶんは空の訳文として扱う。
pub fn join(plan: &ChunkPlan, translations: &[&str]) -> String {
    let mut out = String::new();
    for (index, chunk) in plan.chunks.iter().enumerate() {
        out.push_str(&chunk.separator_before);
        out.push_str(translations.get(index).copied().unwrap_or("").trim());
    }
    out.push_str(&plan.trailing_separator);
    out
}

/// 段落。`separator_before` は、前の段落とこの段落の間(または先頭)の空行。
struct Paragraph {
    separator_before: String,
    text: String,
}

/// 予算に収まるようまとめている途中の段落。
struct ParagraphGroup {
    separator_before: String,
    text: String,
    /// `text` の文字数。区切り(先頭の空行)は翻訳しないので数に入れない。
    len: usize,
}

impl ParagraphGroup {
    fn from_paragraph(paragraph: Paragraph) -> Self {
        let len = paragraph.text.chars().count();
        Self {
            separator_before: paragraph.separator_before,
            text: paragraph.text,
            len,
        }
    }

    fn into_chunk(self) -> Chunk {
        Chunk {
            separator_before: self.separator_before,
            text: self.text,
        }
    }
}

/// 段落をグループへ足す。入らなければ、その段落を返す。
fn push_paragraph(
    group: &mut Option<ParagraphGroup>,
    paragraph: Paragraph,
    budget: usize,
) -> Option<Paragraph> {
    let Some(current) = group else {
        *group = Some(ParagraphGroup::from_paragraph(paragraph));
        return None;
    };
    let separator_len = paragraph.separator_before.chars().count();
    let text_len = paragraph.text.chars().count();
    if current.len + separator_len + text_len <= budget {
        current.text.push_str(&paragraph.separator_before);
        current.text.push_str(&paragraph.text);
        current.len += separator_len + text_len;
        None
    } else {
        Some(paragraph)
    }
}

fn split_paragraphs(text: &str) -> (Vec<Paragraph>, String) {
    let mut segments: Vec<Segment> = Vec::new();
    let mut index = 0;
    let mut text_start = 0;
    while index < text.len() {
        if let Some(run) = newline_run(text, index) {
            if run.count >= 2 {
                if text_start < index {
                    segments.push(Segment::Text(text[text_start..index].to_owned()));
                }
                segments.push(Segment::Separator(text[index..run.end].to_owned()));
                index = run.end;
                text_start = index;
                continue;
            }
            // 改行1つは段落の中の改行。本文に残す。
            index = run.end;
            continue;
        }
        let character = text[index..].chars().next().expect("index は文字の境界");
        index += character.len_utf8();
    }
    if text_start < text.len() {
        segments.push(Segment::Text(text[text_start..].to_owned()));
    }

    let mut folded: Vec<Segment> = Vec::new();
    for segment in segments {
        match segment {
            Segment::Text(body) if body.trim().is_empty() => push_separator(&mut folded, body),
            Segment::Separator(separator) => push_separator(&mut folded, separator),
            Segment::Text(body) => folded.push(Segment::Text(body)),
        }
    }

    let mut paragraphs = Vec::new();
    let mut pending_separator = String::new();
    for segment in folded {
        match segment {
            Segment::Separator(separator) => pending_separator.push_str(&separator),
            Segment::Text(body) => paragraphs.push(Paragraph {
                separator_before: std::mem::take(&mut pending_separator),
                text: body,
            }),
        }
    }
    (paragraphs, pending_separator)
}

enum Segment {
    Text(String),
    Separator(String),
}

fn push_separator(segments: &mut Vec<Segment>, separator: String) {
    if let Some(Segment::Separator(existing)) = segments.last_mut() {
        existing.push_str(&separator);
    } else {
        segments.push(Segment::Separator(separator));
    }
}

/// 予算を超えた段落を、文の区切り(それでも超えるときは文字数)でブロックにする。
/// 戻り値の2つ目は、最後の文の後ろに付いていた空白。
fn split_oversized(text: &str, budget: usize) -> (Vec<Chunk>, String) {
    let (pieces, leftover) = split_sentences(text);
    let pieces = pieces
        .into_iter()
        .flat_map(|piece| force_split(piece, budget))
        .collect();
    (pack_pieces(pieces, budget), leftover)
}

struct Piece {
    separator_before: String,
    text: String,
}

fn split_sentences(text: &str) -> (Vec<Piece>, String) {
    let mut pieces = Vec::new();
    let mut separator_before = String::new();
    let mut start = 0;
    let mut index = 0;

    while index < text.len() {
        if let Some(length) = one_newline(text, index) {
            push_piece(&mut pieces, text, start, index, &mut separator_before);
            separator_before.push_str(&text[index..index + length]);
            index += length;
            start = index;
            continue;
        }

        let character = text[index..].chars().next().expect("index は文字の境界");
        let next = index + character.len_utf8();
        if is_sentence_end(text, character, next) {
            let mut end_of_space = next;
            while end_of_space < text.len() {
                let space = text[end_of_space..]
                    .chars()
                    .next()
                    .expect("end_of_space は文字の境界");
                if is_horizontal_space(space) {
                    end_of_space += space.len_utf8();
                } else {
                    break;
                }
            }
            push_piece(&mut pieces, text, start, next, &mut separator_before);
            separator_before.push_str(&text[next..end_of_space]);
            index = end_of_space;
            start = index;
            continue;
        }
        index = next;
    }

    push_piece(&mut pieces, text, start, text.len(), &mut separator_before);
    (pieces, separator_before)
}

fn push_piece(
    pieces: &mut Vec<Piece>,
    text: &str,
    start: usize,
    end: usize,
    separator_before: &mut String,
) {
    if start >= end {
        return;
    }
    pieces.push(Piece {
        separator_before: std::mem::take(separator_before),
        text: text[start..end].to_owned(),
    });
}

fn is_sentence_end(text: &str, character: char, next: usize) -> bool {
    if matches!(character, '。' | '！' | '？' | '!' | '?') {
        return true;
    }
    // `.` は小数や略語の途中を避け、直後が空白か文末のときだけ区切る。
    character == '.' && text[next..].chars().next().is_none_or(char::is_whitespace)
}

fn is_horizontal_space(character: char) -> bool {
    matches!(character, ' ' | '\t' | '\u{00A0}' | '\u{3000}')
}

fn force_split(piece: Piece, budget: usize) -> Vec<Piece> {
    if piece.text.chars().count() <= budget {
        return vec![piece];
    }
    let mut pieces = Vec::new();
    let mut buffer = String::new();
    let mut count = 0;
    let mut separator = Some(piece.separator_before);
    for character in piece.text.chars() {
        if count == budget {
            pieces.push(Piece {
                separator_before: separator.take().unwrap_or_default(),
                text: std::mem::take(&mut buffer),
            });
            count = 0;
        }
        buffer.push(character);
        count += 1;
    }
    if !buffer.is_empty() {
        pieces.push(Piece {
            separator_before: separator.take().unwrap_or_default(),
            text: buffer,
        });
    }
    pieces
}

fn pack_pieces(pieces: Vec<Piece>, budget: usize) -> Vec<Chunk> {
    let mut chunks = Vec::new();
    let mut separator_before = String::new();
    let mut text = String::new();
    let mut len = 0;

    for piece in pieces {
        let piece_len = piece.text.chars().count();
        let separator_len = piece.separator_before.chars().count();
        if text.is_empty() {
            separator_before = piece.separator_before;
            text = piece.text;
            len = piece_len;
        } else if len + separator_len + piece_len <= budget {
            text.push_str(&piece.separator_before);
            text.push_str(&piece.text);
            len += separator_len + piece_len;
        } else {
            chunks.push(Chunk {
                separator_before: std::mem::take(&mut separator_before),
                text: std::mem::take(&mut text),
            });
            separator_before = piece.separator_before;
            text = piece.text;
            len = piece_len;
        }
    }
    if !text.is_empty() {
        chunks.push(Chunk {
            separator_before,
            text,
        });
    }
    chunks
}

struct NewlineRun {
    end: usize,
    count: usize,
}

/// `start` から続く改行。無ければ `None`。`\r\n` は1つの改行として数える。
fn newline_run(text: &str, start: usize) -> Option<NewlineRun> {
    let mut end = start;
    let mut count = 0;
    while let Some(length) = one_newline(text, end) {
        end += length;
        count += 1;
    }
    (count > 0).then_some(NewlineRun { end, count })
}

fn one_newline(text: &str, index: usize) -> Option<usize> {
    let bytes = text.as_bytes().get(index..)?;
    match bytes {
        [b'\r', b'\n', ..] => Some(2),
        [b'\n', ..] | [b'\r', ..] => Some(1),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 区切りを戻して原文を組み立て直す。翻訳はせず、分割が文字を落とさないことの確認に使う。
    fn rebuild(plan: &ChunkPlan) -> String {
        let mut out = String::new();
        for chunk in &plan.chunks {
            out.push_str(&chunk.separator_before);
            out.push_str(&chunk.text);
        }
        out.push_str(&plan.trailing_separator);
        out
    }

    fn assert_roundtrip(text: &str, budget: usize) {
        let plan = split(text, budget);
        assert_eq!(rebuild(&plan), text, "budget {budget}");
        for chunk in &plan.chunks {
            assert!(!chunk.text.is_empty(), "{chunk:?}");
            assert!(
                chunk.text.chars().count() <= budget.max(1),
                "予算を超えた: {:?} (budget {budget})",
                chunk.text
            );
        }
    }

    #[test]
    fn empty_and_whitespace_only_inputs_have_no_chunks() {
        assert_eq!(split("", 1500).chunks, []);
        let blanks = [" ", "\n", "\n\n\n", " \t\n ", "\r\n\r\n"];
        for text in blanks {
            let plan = split(text, 1500);
            assert!(plan.chunks.is_empty(), "{text:?} -> {plan:?}");
            assert_eq!(rebuild(&plan), text);
        }
    }

    #[test]
    fn a_single_paragraph_within_budget_stays_one_chunk() {
        let plan = split("Hello, world.", 1500);

        assert_eq!(plan.chunks.len(), 1);
        assert_eq!(plan.chunks[0].separator_before, "");
        assert_eq!(plan.chunks[0].text, "Hello, world.");
        assert_eq!(plan.trailing_separator, "");
    }

    #[test]
    fn a_paragraph_that_is_exactly_the_budget_is_not_split_further() {
        let text = "あ".repeat(1500);
        let plan = split(&text, 1500);

        assert_eq!(plan.chunks.len(), 1);
        assert_eq!(plan.chunks[0].text, text);
        // 文の区切りがあっても、段落が予算以内なら分けない
        let with_period = split("Hi. Yo", 6);
        assert_eq!(with_period.chunks.len(), 1);
        assert_eq!(with_period.chunks[0].text, "Hi. Yo");
    }

    #[test]
    fn adjacent_paragraphs_are_packed_until_the_budget() {
        let packed = split("ab\n\ncd", 6);
        assert_eq!(packed.chunks.len(), 1);
        assert_eq!(packed.chunks[0].text, "ab\n\ncd");

        let separate = split("ab\n\ncd", 5);
        assert_eq!(separate.chunks.len(), 2);
        assert_eq!(separate.chunks[0].text, "ab");
        assert_eq!(separate.chunks[1].separator_before, "\n\n");
        assert_eq!(separate.chunks[1].text, "cd");
    }

    #[test]
    fn a_paragraph_over_the_budget_is_split_on_sentences() {
        let plan = split("あいう。えおか。", 4);

        assert_eq!(
            plan.chunks
                .iter()
                .map(|chunk| chunk.text.as_str())
                .collect::<Vec<_>>(),
            ["あいう。", "えおか。"]
        );
        assert!(
            plan.chunks
                .iter()
                .all(|chunk| chunk.separator_before.is_empty())
        );
    }

    #[test]
    fn sentence_endings_in_japanese_english_and_korean() {
        // 1文が予算ちょうどで、次の文は入らない。
        let japanese = split("こんにちは。世界です。はい。", 6);
        assert_eq!(
            japanese
                .chunks
                .iter()
                .map(|chunk| chunk.text.as_str())
                .collect::<Vec<_>>(),
            ["こんにちは。", "世界です。", "はい。"]
        );

        let english = split("Hi! OK? Yes.", 4);
        assert_eq!(
            english
                .chunks
                .iter()
                .map(|chunk| chunk.text.as_str())
                .collect::<Vec<_>>(),
            ["Hi!", "OK?", "Yes."]
        );
        assert_eq!(english.chunks[1].separator_before, " ");
        assert_eq!(english.chunks[2].separator_before, " ");

        let korean = split("안녕. 반가워", 3);
        assert_eq!(korean.chunks[0].text, "안녕.");
        assert_eq!(korean.chunks[1].separator_before, " ");
        assert_eq!(korean.chunks[1].text, "반가워");
    }

    #[test]
    fn a_period_splits_only_before_whitespace_or_the_end() {
        let decimal = split("値は3.14です", 4);
        assert!(
            decimal
                .chunks
                .iter()
                .any(|chunk| chunk.text.contains("3.14"))
                || decimal
                    .chunks
                    .iter()
                    .map(|chunk| chunk.text.as_str())
                    .collect::<String>()
                    .contains("3.14"),
            "{decimal:?}"
        );
        // 小数点では分けないので、強制的に切ったとしても `.` の直後は数字のまま隣り合う
        assert_eq!(rebuild(&decimal), "値は3.14です");

        let abbreviation = split("See Mr. Smith.", 6);
        assert_eq!(rebuild(&abbreviation), "See Mr. Smith.");
        assert!(
            abbreviation
                .chunks
                .iter()
                .any(|chunk| chunk.text == "Mr." || chunk.separator_before.starts_with(' ')),
            "空白の前のピリオドでは区切る: {abbreviation:?}"
        );
    }

    #[test]
    fn a_long_line_without_breaks_is_cut_at_the_budget() {
        let plan = split("abcdefghij", 3);

        assert_eq!(
            plan.chunks
                .iter()
                .map(|chunk| chunk.text.as_str())
                .collect::<Vec<_>>(),
            ["abc", "def", "ghi", "j"]
        );
        assert!(
            plan.chunks
                .iter()
                .all(|chunk| chunk.separator_before.is_empty())
        );
    }

    #[test]
    fn blank_lines_and_crlf_are_preserved() {
        assert_roundtrip("A\r\n\r\nB", 1);
        assert_roundtrip("A\r\nB", 1);
        assert_roundtrip("A\r\n\nB", 1);
        assert_roundtrip("A\n\n\n\nB", 1);
        assert_roundtrip("\n\nA\n\nB\n\n", 1);
        assert_roundtrip("\n\nA\n\nB\n\n", 1500);
        assert_roundtrip("A\n\n \n\nB", 1);
        assert_roundtrip("A\n\n \n\nB", 1500);

        let leading = split("\n\nHello\n\n\nWorld\n\n", 1500);
        assert_eq!(leading.chunks.len(), 1);
        assert_eq!(leading.chunks[0].separator_before, "\n\n");
        assert_eq!(leading.chunks[0].text, "Hello\n\n\nWorld");
        assert_eq!(leading.trailing_separator, "\n\n");
    }

    #[test]
    fn a_whitespace_only_paragraph_is_not_its_own_chunk() {
        let plan = split("A\n\n   \n\nB", 1);

        assert_eq!(plan.chunks.len(), 2);
        assert_eq!(plan.chunks[0].text, "A");
        assert_eq!(plan.chunks[1].separator_before, "\n\n   \n\n");
        assert_eq!(plan.chunks[1].text, "B");
    }

    #[test]
    fn a_zero_budget_is_treated_as_one_character() {
        let plan = split("ab", 0);
        assert_eq!(
            plan.chunks
                .iter()
                .map(|chunk| chunk.text.as_str())
                .collect::<Vec<_>>(),
            ["a", "b"]
        );
    }

    #[test]
    fn splitting_does_not_drop_or_duplicate_characters() {
        let samples = [
            "",
            "a",
            "あいうえお",
            "Hello. World! Yes?",
            "一行目\n二行目",
            "段落1\n\n段落2\n\n\n段落3",
            "\n\n先頭\n末尾\n\n",
            "Wait... next",
            "3.14 is pi.",
            "안녕. 잘 부탁해",
            "やあ！　こんにちは。",
            "a\r\nb\r\n\r\nc",
            "  indented",
        ];
        for text in samples {
            for budget in [0, 1, 2, 3, 4, 5, 8, 1500] {
                assert_roundtrip(text, budget);
            }
        }
    }

    #[test]
    fn join_trims_each_translation_and_restores_the_separators() {
        let plan = split("\n\nA\n\nB\n\n", 1);
        let joined = join(&plan, &["  aaa \n", "\n bbb  "]);

        assert_eq!(joined, "\n\naaa\n\nbbb\n\n");
    }

    #[test]
    fn join_keeps_a_space_that_was_between_sentences() {
        let plan = split("Hello. World", 6);
        let joined = join(&plan, &["こんにちは。", "世界"]);

        assert_eq!(joined, "こんにちは。 世界");
    }

    #[test]
    fn a_line_break_inside_an_oversized_paragraph_is_kept() {
        let plan = split("abcd\nefgh", 4);

        assert_eq!(plan.chunks.len(), 2);
        assert_eq!(plan.chunks[0].text, "abcd");
        assert_eq!(plan.chunks[1].separator_before, "\n");
        assert_eq!(plan.chunks[1].text, "efgh");
    }
}
