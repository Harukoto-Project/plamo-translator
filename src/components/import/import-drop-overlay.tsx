import { useTranslation } from "react-i18next";

/** ファイルをドラッグしているあいだ、原文欄の上に出す案内。 */
export function ImportDropOverlay() {
  const { t } = useTranslation();

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-primary/10 px-6 text-center text-sm">
      {t("import.dropHint")}
    </div>
  );
}
