import type { AppError } from "@/types/bindings";

/**
 * テキストの上限(バイト)。Rustの `importer::TEXT_MAX_BYTES` と同じ値。
 * 種類が分かる前の画面側の検査では使わず、文言とRust側の検査に合わせるための定数。
 */
export const TEXT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * PDFの上限(バイト)。Rustの `importer::PDF_MAX_BYTES` と同じ値。
 * ドロップ時は種類が分かる前なので、この値を超えるものは読まずに断る。
 */
export const PDF_MAX_BYTES = 25 * 1024 * 1024;

/**
 * ドロップされたファイルを、読み込む前に断る理由。
 * 読めるときは `null`。複数のときは1件も取り込まない。
 */
export function errorForDroppedFiles(
  files: { size: number }[],
): AppError | null {
  if (files.length > 1) return { kind: "fileTooMany" };
  const file = files[0];
  if (file === undefined) return null;
  if (file.size === 0) return { kind: "fileEmpty" };
  if (file.size > PDF_MAX_BYTES) {
    return { kind: "fileTooLarge", size: file.size, limit: PDF_MAX_BYTES };
  }
  return null;
}
