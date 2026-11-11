import { useTranslation } from "react-i18next";
import { HistoryItem } from "@/components/sidebar/history-item";
import { Button } from "@/components/ui/button";
import { describeAppError } from "@/lib/app-error";
import type { HistoryGroup } from "@/lib/history-groups";
import { toAppError } from "@/services/ipc";
import type { HistorySummary } from "@/types/bindings";

interface HistoryListProps {
  groups: HistoryGroup<HistorySummary>[];
  activeId: string | null;
  disabled: boolean;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  /** 保存済みの履歴が1件もないか(検索で絞った結果が空のときとは区別する)。 */
  isEmpty: boolean;
  /** 一部のファイルを読めずに一覧から外した件数。 */
  skipped: number;
  onOpen: (id: string) => void;
  onRename: (entry: HistorySummary) => void;
  onDelete: (entry: HistorySummary) => void;
}

/** 日付ごとにまとめた履歴の一覧。読み込み中・失敗・空のときの表示も持つ。 */
export function HistoryList({
  groups,
  activeId,
  disabled,
  loading,
  error,
  onRetry,
  isEmpty,
  skipped,
  onOpen,
  onRename,
  onDelete,
}: HistoryListProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <p role="status" className="px-2 text-sm text-muted-foreground">
        {t("history.loading")}
      </p>
    );
  }

  if (error) {
    return (
      <div className="px-2">
        <p className="text-sm text-destructive">
          {t("history.loadFailed")}: {describeAppError(toAppError(error), t)}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={onRetry}
        >
          {t("history.retry")}
        </Button>
      </div>
    );
  }

  const skippedNote = skipped > 0 && (
    <p className="px-2 pt-2 text-xs text-muted-foreground">
      {t("history.skipped", { count: skipped })}
    </p>
  );

  if (groups.length === 0) {
    return (
      <>
        <p className="px-2 text-sm text-muted-foreground">
          {isEmpty ? t("history.empty") : t("history.noResults")}
        </p>
        {skippedNote}
      </>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <section key={group.id} className="mb-3">
          <h2 className="px-2 pb-1 text-xs text-muted-foreground">
            {t(`history.groups.${group.id}`)}
          </h2>
          <ul>
            {group.items.map((entry) => (
              <li key={entry.id}>
                <HistoryItem
                  entry={entry}
                  active={entry.id === activeId}
                  disabled={disabled}
                  onOpen={onOpen}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {skippedNote}
    </>
  );
}
