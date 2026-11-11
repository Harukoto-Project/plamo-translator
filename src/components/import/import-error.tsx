import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { describeAppError } from "@/lib/app-error";
import type { AppError } from "@/types/bindings";

interface ImportErrorProps {
  error: AppError | null;
}

/** ファイルを取り込めなかった理由。原文欄の中に出す。 */
export function ImportError({ error }: ImportErrorProps) {
  const { t } = useTranslation();
  if (error === null) return null;

  return (
    <Alert variant="destructive" className="mx-3 mb-2">
      <AlertDescription>{describeAppError(error, t)}</AlertDescription>
    </Alert>
  );
}
