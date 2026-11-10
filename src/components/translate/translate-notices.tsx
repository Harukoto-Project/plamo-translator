import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { describeAppError } from "@/lib/app-error";
import type { TranslateState } from "@/lib/translate-state";

interface TranslateNoticesProps {
  state: TranslateState;
}

/** 翻訳のエラーと警告。翻訳は続行している警告は、エラーとは見た目を分ける。 */
export function TranslateNotices({ state }: TranslateNoticesProps) {
  const { t } = useTranslation();

  if (state.error === null && state.warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {state.error && (
        <Alert variant="destructive">
          <AlertTitle>{t("translate.errorTitle")}</AlertTitle>
          <AlertDescription>
            {describeAppError(state.error, t)}
          </AlertDescription>
        </Alert>
      )}
      {state.warnings.map((warning) => (
        <Alert key={warning}>
          <AlertDescription>
            {t(`translate.warnings.${warning}`)}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
