import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAppInfo } from "@/hooks/use-app-info";

/** 翻訳画面。土台(⓪)ではプレースホルダー。翻訳の本体は①で作る。 */
export function TranslatePage() {
  const { t } = useTranslation();
  const { data, isError, refetch } = useAppInfo();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-serif text-3xl">{t("app.name")}</h1>
      <p className="text-muted-foreground">{t("app.tagline")}</p>
      {data && (
        <p className="text-sm text-muted-foreground">
          {data.name} v{data.version}
        </p>
      )}
      {isError && (
        <Button variant="outline" onClick={() => refetch()}>
          {t("appInfo.retry")}
        </Button>
      )}
    </main>
  );
}
