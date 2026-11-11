import { useTranslation } from "react-i18next";
import { ConnectionDialog } from "@/components/settings/connection-dialog";
import { useAppInfo } from "@/hooks/use-app-info";

/** 窓の上端。アプリ名とバージョン、全画面で共通の操作(接続設定)を置く。 */
export function AppHeader() {
  const { t } = useTranslation();
  const { data: appInfo } = useAppInfo();

  return (
    <header className="mx-auto flex h-14 w-full max-w-6xl shrink-0 items-center justify-between gap-3 px-3 sm:px-6">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="truncate font-serif text-xl">{t("app.name")}</h1>
        {appInfo && (
          <p className="shrink-0 text-xs text-muted-foreground">
            {appInfo.name} v{appInfo.version}
          </p>
        )}
      </div>
      <ConnectionDialog />
    </header>
  );
}
