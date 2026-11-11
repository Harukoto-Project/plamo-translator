import { useTranslation } from "react-i18next";
import { LanguageSelect } from "@/components/translate/language-select";
import { SwapButton } from "@/components/translate/swap-button";
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

/**
 * 紙面の上端。原文と訳文の言語を、それぞれのペインの真上に置く。
 * 左右に並ぶ幅では、入れ替えボタンを中央の綴じ目に載せる。
 */
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
    <div className="relative flex h-12 shrink-0 items-center gap-2 border-b px-2 @3xl:grid @3xl:grid-cols-2 @3xl:gap-0 @3xl:px-0">
      <div className="flex min-w-0 flex-1 items-center gap-1 @3xl:h-full @3xl:px-2">
        <LanguageSelect
          label={t("translate.sourceLanguage")}
          value={sourceChoice}
          options={sourceOptions}
          onChange={onSourceChange}
          disabled={disabled}
        />
        {detected && (
          <span className="truncate text-xs text-muted-foreground">
            {t("translate.detected", { language: t(`languages.${detected}`) })}
          </span>
        )}
      </div>
      <SwapButton
        onSwap={onSwap}
        disabled={disabled}
        className="shrink-0 @3xl:absolute @3xl:top-1/2 @3xl:left-1/2 @3xl:z-10 @3xl:-translate-x-1/2 @3xl:-translate-y-1/2"
      />
      <div className="flex min-w-0 flex-1 items-center @3xl:h-full @3xl:border-l @3xl:pr-2 @3xl:pl-7">
        <LanguageSelect
          label={t("translate.targetLanguage")}
          value={targetLang}
          options={targetOptions}
          onChange={onTargetChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
