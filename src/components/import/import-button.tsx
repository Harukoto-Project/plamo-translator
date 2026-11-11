import { PaperclipIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface ImportButtonProps {
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}

/** 原文欄のフッターに置く、ファイルを選ぶボタン。 */
export function ImportButton({ busy, disabled, onClick }: ImportButtonProps) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      disabled={disabled || busy}
      aria-busy={busy}
      onClick={onClick}
    >
      <PaperclipIcon aria-hidden="true" />
      {busy ? t("import.busy") : t("import.pick")}
    </Button>
  );
}
