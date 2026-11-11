import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteHistory } from "@/hooks/use-history";
import { describeAppError } from "@/lib/app-error";
import { toAppError } from "@/services/ipc";
import type { HistorySummary } from "@/types/bindings";

interface DeleteHistoryDialogProps {
  entry: HistorySummary | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

/** 履歴の削除を確認してから、すぐ消す。 */
export function DeleteHistoryDialog({
  entry,
  onClose,
  onDeleted,
}: DeleteHistoryDialogProps) {
  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {entry && (
          <DeleteHistoryForm
            entry={entry}
            onClose={onClose}
            onDeleted={onDeleted}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteHistoryForm({
  entry,
  onClose,
  onDeleted,
}: {
  entry: HistorySummary;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteHistory();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("history.deleteTitle")}</DialogTitle>
        <DialogDescription>
          {t("history.deleteDescription", { title: entry.title })}
        </DialogDescription>
      </DialogHeader>
      {remove.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {describeAppError(toAppError(remove.error), t)}
          </AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("history.cancel")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate(entry.id, {
              onSuccess: () => {
                onDeleted(entry.id);
                onClose();
              },
            });
          }}
        >
          {remove.isPending ? t("history.deleting") : t("history.delete")}
        </Button>
      </DialogFooter>
    </>
  );
}
