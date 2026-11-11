import { useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { HistorySidebar } from "@/components/sidebar/history-sidebar";
import { LanguageBar } from "@/components/translate/language-bar";
import { SourcePane } from "@/components/translate/source-pane";
import { TargetPane } from "@/components/translate/target-pane";
import { useFileImport } from "@/hooks/use-file-import";
import { useLanguageSelection } from "@/hooks/use-language-selection";
import { useRecordTranslation } from "@/hooks/use-record-translation";
import { useSettings } from "@/hooks/use-settings";
import { useTranslator } from "@/hooks/use-translator";
import { loadHistory } from "@/services/history";

/**
 * 翻訳画面。原文と訳文を1枚の紙面に並べ、中央の綴じ目で分ける。
 * 左右 / 上下は、窓ではなく紙面の幅(コンテナクエリ)で切り替える。
 * 履歴は左に並べ、開くと原文・訳文・言語を戻す(再翻訳はしない)。
 */
export function TranslatePage() {
  const [sourceText, setSourceText] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const language = useLanguageSelection(sourceText);
  const translator = useTranslator();
  const settings = useSettings();
  const { state } = translator;
  const running = state.status === "running";
  const record = useRecordTranslation(
    state.status,
    state.text,
    setActiveHistoryId,
  );
  const fileImport = useFileImport(setSourceText, running);

  const translate = () => {
    if (running || sourceText.trim() === "") return;
    const pair = language.resolve();
    record.arm({
      id: crypto.randomUUID(),
      sourceLang: pair.source,
      targetLang: pair.target,
      sourceText,
      model: settings.data?.connection.model ?? "",
    });
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
      fileImport.clearError();
      setSourceText(state.text);
      translator.reset();
    }
  };

  const startNew = () => {
    if (running) return;
    record.moveOn();
    fileImport.clearError();
    setSourceText("");
    translator.reset();
    setActiveHistoryId(null);
  };

  const openHistory = async (id: string) => {
    if (running) return;
    record.moveOn();
    const entry = await loadHistory(id);
    fileImport.clearError();
    setSourceText(entry.sourceText);
    language.apply(entry.sourceLang, entry.targetLang);
    translator.load(entry.targetText);
    setActiveHistoryId(entry.id);
  };

  return (
    <div className="flex min-h-svh bg-frame">
      <HistorySidebar
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        activeId={activeHistoryId}
        disabled={running}
        saveError={record.error}
        onNew={startNew}
        onOpen={openHistory}
        onDeleted={(id) => {
          if (activeHistoryId === id) setActiveHistoryId(null);
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenHistory={() => setHistoryOpen(true)} />
        <main className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="@container flex min-h-104 flex-1 flex-col overflow-hidden rounded-xl border bg-sheet shadow-xs max-h-96 mt-6">
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
                onChange={(value) => {
                  fileImport.clearError();
                  setSourceText(value);
                }}
                running={running}
                onTranslate={translate}
                onStop={translator.stop}
                importBusy={fileImport.busy}
                importDragging={fileImport.dragging}
                importError={fileImport.error}
                onPickFile={fileImport.pick}
                dropHandlers={fileImport.dropHandlers}
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
    </div>
  );
}
