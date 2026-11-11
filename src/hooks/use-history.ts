import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteHistory,
  listHistory,
  renameHistory,
  saveHistory,
} from "@/services/history";
import type { SaveHistory } from "@/types/bindings";

export const historyKey = ["history"] as const;

/** 履歴の一覧(更新が新しい順)。 */
export function useHistoryList() {
  return useQuery({ queryKey: historyKey, queryFn: listHistory });
}

/** 完了した翻訳を保存し、一覧を読み直す。 */
export function useSaveHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: SaveHistory) => saveHistory(entry),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: historyKey });
    },
  });
}

/** 履歴の名前を変える。 */
export function useRenameHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameHistory(id, title),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: historyKey });
    },
  });
}

/** 履歴を削除する。 */
export function useDeleteHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHistory(id),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: historyKey });
    },
  });
}
