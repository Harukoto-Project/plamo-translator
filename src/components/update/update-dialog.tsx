import { LoaderCircle } from "lucide-react";
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
import { useAppUpdate } from "@/hooks/use-app-update";

/**
 * 新しいバージョンがあるときに出す確認。
 * 「更新して再起動」でダウンロード・インストールし、終わったら再起動する。
 * ダウンロード中は閉じられない(途中で閉じると、何が起きているか分からなくなるため)。
 * リリースノートは出さない。
 */
export function UpdateDialog({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const app = useAppUpdate({ enabled });
  const open = app.update !== null && !app.dismissed;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !app.installing) app.dismiss();
      }}
      disablePointerDismissal={app.installing}
    >
      <DialogContent showCloseButton={false} aria-busy={app.installing}>
        <DialogHeader>
          <DialogTitle>{t("update.title")}</DialogTitle>
          <DialogDescription>
            {app.update
              ? t("update.availableDescription", {
                  current: app.update.currentVersion,
                  next: app.update.version,
                })
              : null}
          </DialogDescription>
        </DialogHeader>
        {app.installing && <DownloadMeter percent={app.percent} />}
        {app.installError && (
          <Alert variant="destructive">
            <AlertDescription>
              {installFailureText(app.installError, t)}
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={app.installing}
            onClick={app.dismiss}
          >
            {t("update.later")}
          </Button>
          <Button type="button" disabled={app.installing} onClick={app.install}>
            {app.installing && (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            )}
            {app.installError
              ? t("update.retry")
              : t("update.installAndRestart")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DownloadMeter({ percent }: { percent: number | null }) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-sm">
        <span>{t("update.downloading")}</span>
        {percent !== null && <span>{t("update.percent", { percent })}</span>}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-label={t("update.downloading")}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={
            percent === null
              ? "h-full w-1/3 animate-pulse bg-primary"
              : "h-full bg-primary"
          }
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function installFailureText(
  error: unknown,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const detail = error instanceof Error ? error.message : "";
  if (detail.length > 0) return t("update.installFailed", { detail });
  return t("update.installFailedUnknown");
}
