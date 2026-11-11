//! ファイルの中身から、テキストかPDFかを決める。
//!
//! 拡張子は見ない。判定の順は、PDFのヘッダ、画像のヘッダ、UTF-8のテキスト。

use super::pdf;
use crate::error::AppError;

#[derive(Clone, Copy)]
pub(super) enum ImportKind {
    Text,
    Pdf,
}

/// バイト列の種類。空は [`AppError::FileEmpty`]。
pub(super) fn classify(bytes: &[u8]) -> Result<ImportKind, AppError> {
    if bytes.is_empty() {
        return Err(AppError::FileEmpty);
    }
    if pdf::is_pdf(bytes) {
        return Ok(ImportKind::Pdf);
    }
    if is_image(bytes) {
        return Err(AppError::FileUnsupported);
    }
    let body = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    if body.is_empty() {
        // BOMだけのファイル。呼び出し側が空として扱う
        return Ok(ImportKind::Text);
    }
    if body.contains(&0) {
        return Err(AppError::FileUnsupported);
    }
    if std::str::from_utf8(body).is_ok() {
        return Ok(ImportKind::Text);
    }
    Err(AppError::FileEncoding)
}

/// UTF-8のテキストにする。先頭のBOMは除く。空ならエラー。
pub(super) fn decode_text(bytes: &[u8]) -> Result<String, AppError> {
    let body = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    let text = std::str::from_utf8(body).map_err(|_| AppError::FileEncoding)?;
    if text.is_empty() {
        return Err(AppError::FileEmpty);
    }
    Ok(text.to_owned())
}

/// 画像(対象外)のヘッダか。誤判定を避けるため、特徴が強いものだけを見る。
fn is_image(bytes: &[u8]) -> bool {
    bytes.starts_with(b"\x89PNG\r\n\x1a\n")
        || bytes.starts_with(b"\xFF\xD8\xFF")
        || bytes.starts_with(b"GIF87a")
        || bytes.starts_with(b"GIF89a")
        || is_webp(bytes)
}

fn is_webp(bytes: &[u8]) -> bool {
    bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP"
}
