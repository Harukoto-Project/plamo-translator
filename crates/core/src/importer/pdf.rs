//! PDFからのテキストの取り出し。

use pdf_oxide::document::PdfDocument;

use crate::error::AppError;

/// PDFのヘッダ(仕様上は先頭1024バイトのどこかにある)。
const HEADER: &[u8] = b"%PDF-";

/// PDFのバイト列か。
pub(super) fn is_pdf(bytes: &[u8]) -> bool {
    bytes
        .windows(HEADER.len())
        .take(1024)
        .any(|window| window == HEADER)
}

/// 全ページのテキストを取り出す。テキストが無いPDFは失敗にする。
pub(super) fn extract_text(bytes: &[u8]) -> Result<String, AppError> {
    let document = PdfDocument::from_bytes(bytes.to_vec()).map_err(|_| AppError::PdfUnreadable)?;
    let text = document
        .extract_all_text()
        .map_err(|_| AppError::PdfUnreadable)?;
    if text.trim().is_empty() {
        return Err(AppError::PdfNoText);
    }
    Ok(text)
}

/// 1ページに `text`(ASCII)を1行だけ書いた、最小のPDF。
#[cfg(test)]
pub(super) fn minimal_pdf(text: &str) -> Vec<u8> {
    let content = format!("BT /F1 18 Tf 72 720 Td ({text}) Tj ET");
    let objects = [
        "<< /Type /Catalog /Pages 2 0 R >>".to_owned(),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_owned(),
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] \
         /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
            .to_owned(),
        format!(
            "<< /Length {} >>\nstream\n{content}\nendstream",
            content.len()
        ),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_owned(),
    ];
    let mut pdf = b"%PDF-1.4\n".to_vec();
    let mut offsets = Vec::new();
    for (index, body) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.extend(format!("{} 0 obj\n{body}\nendobj\n", index + 1).bytes());
    }
    let xref = pdf.len();
    pdf.extend(format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1).bytes());
    for offset in offsets {
        pdf.extend(format!("{offset:010} 00000 n \n").bytes());
    }
    pdf.extend(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n",
            objects.len() + 1
        )
        .bytes(),
    );
    pdf
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_header_is_found_near_the_start_only() {
        assert!(is_pdf(b"%PDF-1.7\n..."));
        assert!(is_pdf(b"junk\n%PDF-1.4"));
        assert!(!is_pdf(b"hello world"));
        let late = [vec![b' '; 2000], b"%PDF-1.4".to_vec()].concat();
        assert!(!is_pdf(&late));
    }

    #[test]
    fn text_is_extracted_from_a_simple_pdf() {
        let text = extract_text(&minimal_pdf("Hello attachment")).unwrap();
        assert!(text.contains("Hello attachment"), "{text:?}");
    }

    #[test]
    fn a_pdf_without_text_is_rejected() {
        assert_eq!(
            extract_text(&minimal_pdf("")).unwrap_err(),
            AppError::PdfNoText
        );
    }

    #[test]
    fn garbage_is_rejected_without_panicking() {
        assert_eq!(
            extract_text(b"%PDF-1.4 this is not really a pdf").unwrap_err(),
            AppError::PdfUnreadable
        );
    }
}
