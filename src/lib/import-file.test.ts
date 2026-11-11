import { describe, expect, it } from "vitest";
import {
  errorForDroppedFiles,
  PDF_MAX_BYTES,
  TEXT_MAX_BYTES,
} from "@/lib/import-file";

describe("errorForDroppedFiles", () => {
  it("1件で上限以内なら、読める", () => {
    expect(errorForDroppedFiles([{ size: 12 }])).toBeNull();
    expect(errorForDroppedFiles([])).toBeNull();
  });

  it("空のファイルと、上限を超えるファイルを断る", () => {
    expect(errorForDroppedFiles([{ size: 0 }])).toEqual({ kind: "fileEmpty" });
    expect(errorForDroppedFiles([{ size: PDF_MAX_BYTES + 1 }])).toEqual({
      kind: "fileTooLarge",
      size: PDF_MAX_BYTES + 1,
      limit: PDF_MAX_BYTES,
    });
  });

  it("複数のファイルは、1件も取り込まない", () => {
    expect(errorForDroppedFiles([{ size: 1 }, { size: 2 }])).toEqual({
      kind: "fileTooMany",
    });
  });

  it("テキストの上限は、PDFより小さい", () => {
    expect(TEXT_MAX_BYTES).toBeLessThan(PDF_MAX_BYTES);
  });
});
