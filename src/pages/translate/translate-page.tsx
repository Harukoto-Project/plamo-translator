import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConnectionDialog } from "@/components/settings/connection-dialog";
import { LanguageBar } from "@/components/translate/language-bar";
import { SourcePane } from "@/components/translate/source-pane";
import { TargetPane } from "@/components/translate/target-pane";
import { TranslateNotices } from "@/components/translate/translate-notices";
import { useAppInfo } from "@/hooks/use-app-info";
import { useLanguageSelection } from "@/hooks/use-language-selection";
import { useTranslator } from "@/hooks/use-translator";

/** 翻訳画面。原文と訳文の2ペイン(広い幅では左右、狭い幅では上下)。 */
export function TranslatePage() {
  const { t } = useTranslation();
  const { data: appInfo } = useAppInfo();
  const [sourceText, setSourceText] = useState("");
  const language = useLanguageSelection(sourceText);
  const translator = useTranslator();
  const { state } = translator;
  const running = state.status === "running";

  const translate = () => {
    const pair = language.resolve();
    translator.translate({
      text: sourceText,
      sourceLang: pair.source,
      targetLang: pair.target,
    });
  };

  /** 言語を入れ替え、訳文があれば原文欄に移す(訳文欄は空にする)。 */
  const swap = () => {
    language.swap();
    if (state.text !== "") {
      setSourceText(state.text);
      translator.reset();
    }
  };

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h1 className="font-serif text-2xl">{t("app.name")}</h1>
          {appInfo && (
            <p className="text-xs text-muted-foreground">
              {appInfo.name} v{appInfo.version}
            </p>
          )}
        </div>
        <ConnectionDialog />
      </header>

      <LanguageBar
        sourceChoice={language.choice}
        targetLang={language.shown.target}
        detected={language.detected}
        onSourceChange={language.selectSource}
        onTargetChange={language.selectTarget}
        onSwap={swap}
        disabled={running}
      />

      <div className="flex flex-1 flex-col gap-4 md:flex-row">
        <SourcePane
          value={sourceText}
          onChange={setSourceText}
          running={running}
          onTranslate={translate}
          onStop={translator.stop}
        />
        <TargetPane
          state={state}
          retranslateDisabled={sourceText.trim() === ""}
          onRetranslate={translate}
        />
      </div>

      <TranslateNotices state={state} />
    </main>
  );
}
