import { unwrap } from "@/services/ipc";
import {
  commands,
  type HistoryEntry,
  type HistoryListing,
  type HistorySummary,
  type SaveHistory,
} from "@/types/bindings";

/** 履歴の一覧(更新が新しい順)。原文と訳文は含まない。 */
export function listHistory(): Promise<HistoryListing> {
  return unwrap(commands.historyList());
}

/** 履歴1件。開いたとき、原文と訳文を画面に戻す。 */
export function loadHistory(id: string): Promise<HistoryEntry> {
  return unwrap(commands.historyLoad(id));
}

/**
 * 完了した翻訳を保存する。原文か訳文が空白だけなら、何も保存されず `null`が返る。
 * 中断・エラーの翻訳では呼ばない。
 */
export function saveHistory(
  entry: SaveHistory,
): Promise<HistorySummary | null> {
  return unwrap(commands.historySave(entry));
}

/** 履歴の名前を変える。 */
export function renameHistory(
  id: string,
  title: string,
): Promise<HistorySummary> {
  return unwrap(commands.historyRename(id, title));
}

/** 履歴を削除する。 */
export async function deleteHistory(id: string): Promise<void> {
  await unwrap(commands.historyDelete(id));
}
