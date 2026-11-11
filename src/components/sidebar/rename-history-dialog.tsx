import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRenameHistory } from "@/hooks/use-history";
import { describeAppError } from "@/lib/app-error";
import { toAppError } from "@/services/ipc";
import type { HistorySummary } from "@/types/bindings";

interface RenameHistoryDialogProps {
  entry: HistorySummary | null;
  onClose: () => void;
}

/** 履歴の名前を変える。空白だけの名前は、Rust が拒否する。 */
export function RenameHistoryDialog({
  entry,
  onClose,
}: RenameHistoryDialogProps) {
  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {entry && <RenameHistoryForm entry={entry} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameHistoryForm({
  entry,
  onClose,
}: {
  entry: HistorySummary;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rename = useRenameHistory();
  const [title, setTitle] = useState(entry.title);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        rename.mutate(
          { id: entry.id, title },
          {
            onSuccess: () => onClose(),
          },
        );
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("history.renameTitle")}</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <Label htmlFor="history-title" className="mb-2">
          {t("history.renameLabel")}
        </Label>
        <Input
          id="history-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoComplete="off"
        />
      </div>
      {rename.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {describeAppError(toAppError(rename.error), t)}
          </AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("history.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={rename.isPending || title.trim() === ""}
        >
          {rename.isPending ? t("history.renaming") : t("history.renameSave")}
        </Button>
      </DialogFooter>
    </form>
  );
}
