import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DeleteHistoryDialog } from "@/components/sidebar/delete-history-dialog";
import { HistoryList } from "@/components/sidebar/history-list";
import { RenameHistoryDialog } from "@/components/sidebar/rename-history-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHistoryList } from "@/hooks/use-history";
import { describeAppError } from "@/lib/app-error";
import { groupByDate } from "@/lib/history-groups";
import { filterByTitle } from "@/lib/history-search";
import { toAppError } from "@/services/ipc";
import type { AppError, HistorySummary } from "@/types/bindings";

interface HistorySidebarProps {
  /** 狭い幅で、サイドバーを重ねて開いているか。 */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeId: string | null;
  /** 翻訳の実行中は、開く・新規・削除・名前の変更を止める。 */
  disabled: boolean;
  /** 保存に失敗したとき。翻訳そのものは画面に残している。 */
  saveError: AppError | null;
  onNew: () => void;
  onOpen: (id: string) => Promise<void>;
  onDeleted: (id: string) => void;
}

/**
 * 左の履歴。広い幅では常に出し、狭い幅ではオーバーレイにする。
 * 検索と日付のグループは、一覧のメタデータだけで行う。
 */
export function HistorySidebar({
  open,
  onOpenChange,
  activeId,
  disabled,
  saveError,
  onNew,
  onOpen,
  onDeleted,
}: HistorySidebarProps) {
  const { t } = useTranslation();
  const closeMobile = () => onOpenChange(false);

  return (
    <>
      <aside
        aria-label={t("history.title")}
        className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar md:flex"
      >
        <HistorySidebarBody
          activeId={activeId}
          disabled={disabled}
          saveError={saveError}
          onNew={onNew}
          onOpen={onOpen}
          onDeleted={onDeleted}
        />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <aside
            aria-label={t("history.title")}
            className="flex h-full w-72 max-w-[80vw] flex-col overflow-hidden border-r border-sidebar-border bg-sidebar"
          >
            <HistorySidebarBody
              activeId={activeId}
              disabled={disabled}
              saveError={saveError}
              onNew={() => {
                onNew();
                closeMobile();
              }}
              onOpen={async (id) => {
                await onOpen(id);
                closeMobile();
              }}
              onDeleted={onDeleted}
            />
          </aside>
          <button
            type="button"
            className="flex-1 bg-black/40"
            aria-label={t("history.close")}
            onClick={closeMobile}
          />
        </div>
      )}
    </>
  );
}

function HistorySidebarBody({
  activeId,
  disabled,
  saveError,
  onNew,
  onOpen,
  onDeleted,
}: {
  activeId: string | null;
  disabled: boolean;
  saveError: AppError | null;
  onNew: () => void;
  onOpen: (id: string) => Promise<void>;
  onDeleted: (id: string) => void;
}) {
  const { t } = useTranslation();
  const history = useHistoryList();
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<HistorySummary | null>(null);
  const [deleting, setDeleting] = useState<HistorySummary | null>(null);
  const [openError, setOpenError] = useState<unknown>(null);

  const entries = history.data?.entries ?? [];
  const groups = groupByDate(filterByTitle(entries, query), new Date());

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <Button
          type="button"
          variant="ghost"
          className="justify-start"
          disabled={disabled}
          onClick={onNew}
        >
          <PlusIcon aria-hidden="true" />
          {t("history.new")}
        </Button>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("history.searchPlaceholder")}
          aria-label={t("history.searchLabel")}
          autoComplete="off"
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <HistoryList
            groups={groups}
            activeId={activeId}
            disabled={disabled}
            loading={history.isPending}
            error={history.error}
            onRetry={() => void history.refetch()}
            isEmpty={entries.length === 0}
            skipped={history.data?.skipped ?? 0}
            onOpen={(id) => {
              setOpenError(null);
              void onOpen(id).catch((error: unknown) => setOpenError(error));
            }}
            onRename={setRenaming}
            onDelete={setDeleting}
          />
        </div>
        {openError != null && (
          <p className="text-xs text-destructive">
            {describeAppError(toAppError(openError), t)}
          </p>
        )}
        {saveError && (
          <p className="text-xs text-destructive">
            {t("history.saveFailed")}: {describeAppError(saveError, t)}
          </p>
        )}
      </div>
      <RenameHistoryDialog entry={renaming} onClose={() => setRenaming(null)} />
      <DeleteHistoryDialog
        entry={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={onDeleted}
      />
    </>
  );
}
