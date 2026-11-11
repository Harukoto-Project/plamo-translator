import { errorForDroppedFiles } from "@/lib/import-file";
import { AppCommandError, unwrap } from "@/services/ipc";
import { commands } from "@/types/bindings";

/** ファイルの中身をbase64にする(`data:` URLの本体部分)。 */
function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => {
      reject(new AppCommandError({ kind: "fileReadFailed", detail: "" }));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * OSのダイアログでファイルを1つ選び、原文のテキストを返す。
 * キャンセルしたときは `null`。
 */
export async function pickImportFile(title: string): Promise<string | null> {
  const imported = await unwrap(commands.importPickFile(title));
  return imported?.text ?? null;
}

/**
 * ドロップされたファイルから原文のテキストを返す。
 * 大きすぎるものは、読み込んで送る前に断る(Rust側でも検査する)。
 */
export async function importDroppedFile(file: File): Promise<string> {
  const early = errorForDroppedFiles([file]);
  if (early) throw new AppCommandError(early);
  const data = await readAsBase64(file);
  const imported = await unwrap(commands.importExtract(data));
  return imported.text;
}
