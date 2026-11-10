import { ArrowLeftRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSelect } from "@/components/translate/language-select";
import { Button } from "@/components/ui/button";
import { languages, type SourceChoice, sourceChoices } from "@/lib/languages";
import type { Lang } from "@/types/bindings";

interface LanguageBarProps {
  sourceChoice: SourceChoice;
  /** 画面に出す訳文の言語(原文と同じになるときは、切り替え済みの値) */
  targetLang: Lang;
  /** 原文が「自動」のときに、判定できた言語 */
  detected: Lang | undefined;
  onSourceChange: (choice: SourceChoice) => void;
  onTargetChange: (lang: Lang) => void;
  onSwap: () => void;
  disabled?: boolean;
}

/** 原文と訳文の言語を選ぶ。原文は「自動」も選べる。 */
export function LanguageBar({
  sourceChoice,
  targetLang,
  detected,
  onSourceChange,
  onTargetChange,
  onSwap,
  disabled,
}: LanguageBarProps) {
  const { t } = useTranslation();

  const sourceOptions = sourceChoices.map((choice) => ({
    value: choice,
    label:
      choice === "auto"
        ? t("translate.languageAuto")
        : t(`languages.${choice}`),
  }));
  const targetOptions = languages.map((lang) => ({
    value: lang,
    label: t(`languages.${lang}`),
  }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <LanguageSelect
        label={t("translate.sourceLanguage")}
        value={sourceChoice}
        options={sourceOptions}
        onChange={onSourceChange}
        disabled={disabled}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("translate.swap")}
        title={t("translate.swap")}
        onClick={onSwap}
        disabled={disabled}
      >
        <ArrowLeftRightIcon aria-hidden="true" />
      </Button>
      <LanguageSelect
        label={t("translate.targetLanguage")}
        value={targetLang}
        options={targetOptions}
        onChange={onTargetChange}
        disabled={disabled}
      />
      {detected && (
        <p className="text-xs text-muted-foreground">
          {t("translate.detected", { language: t(`languages.${detected}`) })}
        </p>
      )}
    </div>
  );
}
