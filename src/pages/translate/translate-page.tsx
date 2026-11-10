import { useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { LanguageBar } from "@/components/translate/language-bar";
import { SourcePane } from "@/components/translate/source-pane";
import { TargetPane } from "@/components/translate/target-pane";
import { useLanguageSelection } from "@/hooks/use-language-selection";
import { useTranslator } from "@/hooks/use-translator";

/**
 * 翻訳画面。原文と訳文を1枚の紙面に並べ、中央の綴じ目で分ける。
 * 左右 / 上下は、窓ではなく紙面の幅(コンテナクエリ)で切り替える。
 */
export function TranslatePage() {
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
    <div className="flex min-h-svh flex-col bg-frame">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col px-3 pb-3 sm:px-6 sm:pb-6">
        <div className="@container flex min-h-104 flex-1 flex-col overflow-hidden rounded-xl border bg-sheet shadow-xs">
          <LanguageBar
            sourceChoice={language.choice}
            targetLang={language.shown.target}
            detected={language.detected}
            onSourceChange={language.selectSource}
            onTargetChange={language.selectTarget}
            onSwap={swap}
            disabled={running}
          />
          <div className="flex min-h-0 flex-1 flex-col @3xl:flex-row">
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
        </div>
      </main>
    </div>
  );
}
