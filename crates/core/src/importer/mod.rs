//! ファイルの取り込み。テキストとPDFから原文の文字列を取り出す。
//!
//! 元ファイルは保存しない。種類は拡張子ではなく中身で決める。
//! 上限はテキスト [`TEXT_MAX_BYTES`]、PDF [`PDF_MAX_BYTES`]。

mod pdf;
mod sniff;

use std::fs::File;
use std::io::Read;
use std::path::Path;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde::Serialize;
use specta::Type;

use crate::error::AppError;
use sniff::ImportKind;

/// テキストとして取り込むときの上限(バイト)。10MiB。
pub const TEXT_MAX_BYTES: u32 = 10 * 1024 * 1024;
/// PDFとして取り込むときの上限(バイト)。25MiB。
pub const PDF_MAX_BYTES: u32 = 25 * 1024 * 1024;

/// 大きすぎるファイルは、先頭このバイト数だけ見て種類を決める(PDFのヘッダを探す範囲と同じ)。
const SNIFF_LEN: usize = 1024;
/// OSのエラーメッセージを画面に出すときの最大文字数。
const MAX_DETAIL_CHARS: usize = 300;

/// 原文欄に展開するテキスト。元ファイルは持たない。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportedText {
    pub text: String,
}

impl ImportedText {
    fn new(text: String) -> Self {
        Self { text }
    }
}

/// ファイルを読み、原文のテキストにする。
pub fn import_path(path: &Path) -> Result<ImportedText, AppError> {
    let bytes = read_within_limit(path)?;
    import_bytes(&bytes)
}

/// base64(標準)の中身を、原文のテキストにする。
///
/// 画面のドロップはパスを渡さず、このバイト列だけを渡す(任意のパスを読まないため)。
pub fn import_base64(data: &str) -> Result<ImportedText, AppError> {
    let bytes = decode_capped(data, PDF_MAX_BYTES)?;
    import_bytes(&bytes)
}

/// すでに読んだバイト列を、原文のテキストにする。
pub fn import_bytes(bytes: &[u8]) -> Result<ImportedText, AppError> {
    let kind = sniff::classify(bytes)?;
    ensure_within_limit(kind, bytes.len() as u64)?;
    let text = match kind {
        ImportKind::Text => sniff::decode_text(bytes)?,
        ImportKind::Pdf => pdf::extract_text(bytes)?,
    };
    Ok(ImportedText::new(text))
}

fn ensure_within_limit(kind: ImportKind, size: u64) -> Result<(), AppError> {
    let limit = match kind {
        ImportKind::Text => TEXT_MAX_BYTES,
        ImportKind::Pdf => PDF_MAX_BYTES,
    };
    if size > u64::from(limit) {
        return Err(file_too_large(size, limit));
    }
    Ok(())
}

fn file_too_large(size: u64, limit: u32) -> AppError {
    AppError::FileTooLarge {
        size: u32::try_from(size).unwrap_or(u32::MAX),
        limit,
    }
}

/// 上限を超えるファイルは全部読まず、先頭だけ見てエラーにする。
fn read_within_limit(path: &Path) -> Result<Vec<u8>, AppError> {
    let metadata = std::fs::metadata(path).map_err(io_failed)?;
    if !metadata.is_file() {
        return Err(AppError::FileUnsupported);
    }
    let size = metadata.len();
    if size == 0 {
        return Err(AppError::FileEmpty);
    }
    if size > u64::from(PDF_MAX_BYTES) {
        let mut file = File::open(path).map_err(io_failed)?;
        let mut prefix = vec![0_u8; sniff_len(size)];
        file.read_exact(&mut prefix).map_err(io_failed)?;
        return Err(oversized(size, &prefix));
    }

    let file = File::open(path).map_err(io_failed)?;
    let mut bytes = Vec::new();
    file.take(u64::from(PDF_MAX_BYTES) + 1)
        .read_to_end(&mut bytes)
        .map_err(io_failed)?;
    if bytes.len() as u64 > u64::from(PDF_MAX_BYTES) {
        let end = bytes.len().min(SNIFF_LEN);
        return Err(oversized(bytes.len() as u64, &bytes[..end]));
    }
    Ok(bytes)
}

fn sniff_len(size: u64) -> usize {
    usize::try_from(size).unwrap_or(SNIFF_LEN).min(SNIFF_LEN)
}

/// 上限を超えたファイルのエラー。中身がテキストでもPDFでもなければ、その理由を優先する。
fn oversized(size: u64, prefix: &[u8]) -> AppError {
    match sniff::classify(prefix) {
        Ok(ImportKind::Text) | Err(AppError::FileEmpty) => file_too_large(size, TEXT_MAX_BYTES),
        Ok(ImportKind::Pdf) => file_too_large(size, PDF_MAX_BYTES),
        Err(error) => error,
    }
}

fn decode_capped(data: &str, max_bytes: u32) -> Result<Vec<u8>, AppError> {
    let limit_chars = encoded_char_limit(max_bytes);
    if data.len() > limit_chars {
        // パディングを無視した上限。画面に出す大きさの目安
        let size = (data.len() as u64 / 4) * 3;
        return Err(file_too_large(size, max_bytes));
    }
    let bytes = STANDARD
        .decode(data)
        .map_err(|_| AppError::FileDataInvalid)?;
    if bytes.len() as u64 > u64::from(max_bytes) {
        return Err(file_too_large(bytes.len() as u64, max_bytes));
    }
    Ok(bytes)
}

/// base64にしたときの最大文字数(パディングを含む)。
fn encoded_char_limit(max_bytes: u32) -> usize {
    usize::try_from(max_bytes)
        .unwrap_or(usize::MAX)
        .div_ceil(3)
        .saturating_mul(4)
}

fn io_failed(error: std::io::Error) -> AppError {
    AppError::FileReadFailed {
        detail: truncate_detail(&error.to_string()),
    }
}

fn truncate_detail(text: &str) -> String {
    if text.chars().count() <= MAX_DETAIL_CHARS {
        return text.to_owned();
    }
    let mut detail: String = text.chars().take(MAX_DETAIL_CHARS).collect();
    detail.push('…');
    detail
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_including_a_bom_is_imported_and_the_bom_is_removed() {
        let text = import_bytes(b"\xEF\xBB\xBFhello").unwrap();
        assert_eq!(text.text, "hello");
    }

    #[test]
    fn japanese_text_is_imported_as_is() {
        let text = import_bytes("こんにちは\n".as_bytes()).unwrap();
        assert_eq!(text.text, "こんにちは\n");
    }

    #[test]
    fn an_empty_file_and_a_bom_only_file_are_rejected() {
        assert_eq!(import_bytes(b"").unwrap_err(), AppError::FileEmpty);
        assert_eq!(
            import_bytes(b"\xEF\xBB\xBF").unwrap_err(),
            AppError::FileEmpty
        );
    }

    #[test]
    fn a_wrong_encoding_and_binary_are_different_errors() {
        // Shift_JISの「あ」
        assert_eq!(
            import_bytes(&[0x82, 0xA0]).unwrap_err(),
            AppError::FileEncoding
        );
        assert_eq!(
            import_bytes(b"abc\0def").unwrap_err(),
            AppError::FileUnsupported
        );
    }

    #[test]
    fn images_are_rejected_from_their_header() {
        let png = [
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        ];
        assert_eq!(import_bytes(&png).unwrap_err(), AppError::FileUnsupported);
        assert_eq!(
            import_bytes(b"\xFF\xD8\xFFjpeg").unwrap_err(),
            AppError::FileUnsupported
        );
        assert_eq!(
            import_bytes(b"GIF89a").unwrap_err(),
            AppError::FileUnsupported
        );
    }

    #[test]
    fn text_over_the_limit_is_rejected_with_the_text_limit() {
        let bytes = vec![b'a'; TEXT_MAX_BYTES as usize + 1];
        assert_eq!(
            import_bytes(&bytes).unwrap_err(),
            AppError::FileTooLarge {
                size: TEXT_MAX_BYTES + 1,
                limit: TEXT_MAX_BYTES,
            }
        );
    }

    #[test]
    fn text_and_the_exact_byte_limits_are_accepted() {
        assert!(import_bytes(b"a").is_ok());
        assert!(ensure_within_limit(ImportKind::Text, u64::from(TEXT_MAX_BYTES)).is_ok());
        assert!(ensure_within_limit(ImportKind::Pdf, u64::from(PDF_MAX_BYTES)).is_ok());
        assert_eq!(
            ensure_within_limit(ImportKind::Pdf, u64::from(PDF_MAX_BYTES) + 1).unwrap_err(),
            AppError::FileTooLarge {
                size: PDF_MAX_BYTES + 1,
                limit: PDF_MAX_BYTES,
            }
        );
    }

    #[test]
    fn a_pdf_is_imported_as_its_text() {
        let text = import_bytes(&pdf::minimal_pdf("Hello")).unwrap();
        assert!(text.text.contains("Hello"), "{:?}", text.text);
    }

    #[test]
    fn base64_round_trips_and_broken_data_is_rejected() {
        let encoded = STANDARD.encode("hello");
        assert_eq!(import_base64(&encoded).unwrap().text, "hello");
        assert_eq!(import_base64("***").unwrap_err(), AppError::FileDataInvalid);
        assert_eq!(import_base64("").unwrap_err(), AppError::FileEmpty);
    }

    #[test]
    fn base64_longer_than_the_pdf_limit_is_rejected_before_decoding() {
        let error = decode_capped("AAAAA", 2).unwrap_err();
        assert!(matches!(error, AppError::FileTooLarge { limit: 2, .. }));
        assert_eq!(encoded_char_limit(3), 4);
        assert_eq!(encoded_char_limit(4), 8);
    }

    #[test]
    fn a_path_is_read_without_creating_another_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("note.txt");
        std::fs::write(&path, "本文").unwrap();

        let text = import_path(&path).unwrap();

        assert_eq!(text.text, "本文");
        let names: Vec<_> = std::fs::read_dir(dir.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        assert_eq!(names, ["note.txt"]);
    }

    #[test]
    fn an_oversized_pdf_is_rejected_from_its_header_without_reading_it_all() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("big.pdf");
        let mut file = File::create(&path).unwrap();
        std::io::Write::write_all(&mut file, b"%PDF-1.4\n").unwrap();
        file.set_len(u64::from(PDF_MAX_BYTES) + 1).unwrap();

        assert_eq!(
            import_path(&path).unwrap_err(),
            AppError::FileTooLarge {
                size: PDF_MAX_BYTES + 1,
                limit: PDF_MAX_BYTES,
            }
        );
    }

    #[test]
    fn an_oversized_text_file_uses_the_text_limit() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("big.txt");
        let mut file = File::create(&path).unwrap();
        // 先頭だけが判定に使われる。ここがNULだと「非対応」になり、上限のエラーにならない
        std::io::Write::write_all(&mut file, &[b'a'; super::SNIFF_LEN]).unwrap();
        file.set_len(u64::from(PDF_MAX_BYTES) + 1).unwrap();

        assert_eq!(
            import_path(&path).unwrap_err(),
            AppError::FileTooLarge {
                size: PDF_MAX_BYTES + 1,
                limit: TEXT_MAX_BYTES,
            }
        );
    }

    #[test]
    fn a_missing_file_reports_the_read_failure_without_panicking() {
        let error = import_path(Path::new("does-not-exist-plamo-import.txt")).unwrap_err();
        assert!(matches!(error, AppError::FileReadFailed { .. }));
    }

    #[test]
    fn a_long_os_message_is_truncated() {
        let long = "あ".repeat(MAX_DETAIL_CHARS + 10);
        let detail = truncate_detail(&long);
        assert_eq!(detail.chars().count(), MAX_DETAIL_CHARS + 1);
        assert!(detail.ends_with('…'));
    }
}
