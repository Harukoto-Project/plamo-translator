import { PanelLeftIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ModelSelect } from "@/components/layout/model-select";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { Button } from "@/components/ui/button";
import { useAppInfo } from "@/hooks/use-app-info";

interface AppHeaderProps {
  /** 狭い幅で履歴を開く。広い幅ではサイドバーが常に出ているので、ボタンは隠す。 */
  onOpenHistory: () => void;
}

/** 窓の上端。アプリ名とバージョン、モデルの選択、設定、履歴を開く操作を置く。 */
export function AppHeader({ onOpenHistory }: AppHeaderProps) {
  const { t } = useTranslation();
  const { data: appInfo } = useAppInfo();

  return (
    <header className="mx-auto flex h-14 w-full max-w-6xl shrink-0 items-center justify-between gap-3 px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t("history.open")}
          onClick={onOpenHistory}
        >
          <PanelLeftIcon aria-hidden="true" />
        </Button>
        <h1 className="truncate font-serif text-xl">{t("app.name")}</h1>
        {appInfo && (
          <p className="shrink-0 text-xs text-muted-foreground">
            {appInfo.name} v{appInfo.version}
          </p>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <ModelSelect />
        <SettingsDialog />
      </div>
    </header>
  );
}
