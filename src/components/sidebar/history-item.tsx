import { PencilIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HistorySummary } from "@/types/bindings";

interface HistoryItemProps {
  entry: HistorySummary;
  active: boolean;
  disabled: boolean;
  onOpen: (id: string) => void;
  onRename: (entry: HistorySummary) => void;
  onDelete: (entry: HistorySummary) => void;
}

/** 履歴の1行。選ぶと翻訳を開く。名前の変更と削除は、行の端のボタン。 */
export function HistoryItem({
  entry,
  active,
  disabled,
  onOpen,
  onRename,
  onDelete,
}: HistoryItemProps) {
  const { t } = useTranslation();

  return (
    <div className="group flex items-center gap-0.5">
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        title={entry.title}
        disabled={disabled}
        className={cn(
          "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent disabled:opacity-50",
          active && "bg-sidebar-accent",
        )}
        onClick={() => onOpen(entry.id)}
      >
        {entry.title}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
        aria-label={t("history.renameItem", { title: entry.title })}
        disabled={disabled}
        onClick={() => onRename(entry)}
      >
        <PencilIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
        aria-label={t("history.deleteItem", { title: entry.title })}
        disabled={disabled}
        onClick={() => onDelete(entry)}
      >
        <Trash2Icon aria-hidden="true" />
      </Button>
    </div>
  );
}
