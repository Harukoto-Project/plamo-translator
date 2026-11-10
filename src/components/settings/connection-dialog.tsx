import { SettingsIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConnectionForm } from "@/components/settings/connection-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApiKeyStatus, useSettings } from "@/hooks/use-settings";
import { describeAppError } from "@/lib/app-error";
import { toAppError } from "@/services/ipc";

/** 接続設定を開くボタンと、そのダイアログ。 */
export function ConnectionDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost">
            <SettingsIcon aria-hidden="true" />
            {t("settings.open")}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.description")}</DialogDescription>
        </DialogHeader>
        {/* 閉じると中身ごと消えるので、開くたびに保存済みの値から入力し直す */}
        <ConnectionDialogBody onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ConnectionDialogBody({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const settings = useSettings();
  const keyStatus = useApiKeyStatus();

  const loadError = settings.error ?? keyStatus.error;
  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {t("settings.loadFailed")}:{" "}
          {describeAppError(toAppError(loadError), t)}
        </AlertDescription>
      </Alert>
    );
  }

  if (!settings.data || !keyStatus.data) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("settings.loading")}
      </p>
    );
  }

  return (
    <ConnectionForm
      initial={settings.data}
      keyStatus={keyStatus.data}
      onSaved={onClose}
      onCancel={onClose}
    />
  );
}
