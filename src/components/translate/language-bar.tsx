import { ArrowRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSelect } from "@/components/translate/language-select";
import type { Lang } from "@/types/bindings";

interface LanguageBarProps {
  sourceLang: Lang;
  targetLang: Lang;
  onSourceChange: (lang: Lang) => void;
  onTargetChange: (lang: Lang) => void;
  disabled?: boolean;
}

/** 原文と訳文の言語を選ぶ。 */
export function LanguageBar({
  sourceLang,
  targetLang,
  onSourceChange,
  onTargetChange,
  disabled,
}: LanguageBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <LanguageSelect
        label={t("translate.sourceLanguage")}
        value={sourceLang}
        onChange={onSourceChange}
        disabled={disabled}
      />
      <ArrowRightIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <LanguageSelect
        label={t("translate.targetLanguage")}
        value={targetLang}
        onChange={onTargetChange}
        disabled={disabled}
      />
    </div>
  );
}
