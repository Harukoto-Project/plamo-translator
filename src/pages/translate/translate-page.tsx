import { useTranslation } from "react-i18next";
import { ConnectionDialog } from "@/components/settings/connection-dialog";
import { LanguageBar } from "@/components/translate/language-bar";
import { SourcePane } from "@/components/translate/source-pane";
import { TargetPane } from "@/components/translate/target-pane";
import { TranslateNotices } from "@/components/translate/translate-notices";
import { useAppInfo } from "@/hooks/use-app-info";
import { useTranslator } from "@/hooks/use-translator";
import {
  changeSourceLang,
  changeTargetLang,
  type LangPair,
} from "@/lib/languages";

/** 翻訳画面。原文と訳文の2ペイン(広い幅では左右、狭い幅では上下)。 */
export function TranslatePage() {
  const { t } = useTranslation();
  const { data: appInfo } = useAppInfo();
  const translator = useTranslator();
  const { sourceLang, targetLang, state } = translator;
  const running = state.status === "running";

  const pair: LangPair = { source: sourceLang, target: targetLang };
  const applyPair = (next: LangPair) => {
    translator.setSourceLang(next.source);
    translator.setTargetLang(next.target);
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
        sourceLang={sourceLang}
        targetLang={targetLang}
        onSourceChange={(lang) => applyPair(changeSourceLang(pair, lang))}
        onTargetChange={(lang) => applyPair(changeTargetLang(pair, lang))}
        disabled={running}
      />

      <div className="flex flex-1 flex-col gap-4 md:flex-row">
        <SourcePane
          value={translator.sourceText}
          onChange={translator.setSourceText}
          running={running}
          onTranslate={translator.translate}
          onStop={translator.stop}
        />
        <TargetPane state={state} />
      </div>

      <TranslateNotices state={state} />
    </main>
  );
}
