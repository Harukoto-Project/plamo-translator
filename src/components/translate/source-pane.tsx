import { SquareIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ImportButton } from "@/components/import/import-button";
import { ImportDropOverlay } from "@/components/import/import-drop-overlay";
import { ImportError } from "@/components/import/import-error";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FileDropHandlers } from "@/hooks/use-file-drop";
import { isMacPlatform, shouldTranslateOnKeyDown } from "@/lib/translate-keys";
import { cn } from "@/lib/utils";
import type { AppError } from "@/types/bindings";

interface SourcePaneProps {
  value: string;
  onChange: (value: string) => void;
  running: boolean;
  onTranslate: () => void;
  onStop: () => void;
  importBusy: boolean;
  importDragging: boolean;
  importError: AppError | null;
  onPickFile: () => void;
  dropHandlers: FileDropHandlers;
}

/** 紙面の左(狭い幅では上)。原文の入力欄と、ファイルの取り込み、翻訳・停止のボタン。 */
export function SourcePane({
  value,
  onChange,
  running,
  onTranslate,
  onStop,
  importBusy,
  importDragging,
  importError,
  onPickFile,
  dropHandlers,
}: SourcePaneProps) {
  const { t } = useTranslation();
  const id = useId();
  const mac = isMacPlatform(navigator.platform);
  const modifier = mac ? "⌘" : "Ctrl";
  const locked = running || importBusy;

  return (
    <section
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col",
        importDragging && "ring-2 ring-primary/40 ring-inset",
      )}
      {...dropHandlers}
    >
      {importDragging && <ImportDropOverlay />}
      <Label htmlFor={id} className="sr-only">
        {t("translate.sourceLabel")}
      </Label>
      <Textarea
        id={id}
        value={value}
        readOnly={importBusy}
        placeholder={t("translate.sourcePlaceholder")}
        className="min-h-28 flex-1 resize-none rounded-none border-0 bg-transparent px-4.5 py-3 text-base leading-relaxed field-sizing-fixed md:text-base dark:bg-transparent"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (shouldTranslateOnKeyDown(event.nativeEvent)) {
            event.preventDefault();
            if (!locked) onTranslate();
          }
        }}
      />
      <ImportError error={importError} />
      <div className="flex h-13 shrink-0 items-center justify-between gap-2 px-3">
        <ImportButton
          busy={importBusy}
          disabled={running}
          onClick={onPickFile}
        />
        {running ? (
          <Button variant="outline" size="lg" onClick={onStop}>
            <SquareIcon aria-hidden="true" className="fill-current" />
            {t("translate.stop")}
          </Button>
        ) : (
          <Button
            size="lg"
            className="pr-1.5"
            onClick={onTranslate}
            disabled={value.trim() === "" || importBusy}
            aria-keyshortcuts={mac ? "Meta+Enter" : "Control+Enter"}
            title={t("translate.shortcut", { modifier })}
          >
            {t("translate.translate")}
            <KbdGroup aria-hidden="true" className="ml-1">
              <Kbd className="bg-primary-foreground/15 text-primary-foreground">
                {modifier}
              </Kbd>
              <Kbd className="bg-primary-foreground/15 text-primary-foreground">
                Enter
              </Kbd>
            </KbdGroup>
          </Button>
        )}
      </div>
    </section>
  );
}
