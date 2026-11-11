import { SquareIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isMacPlatform, shouldTranslateOnKeyDown } from "@/lib/translate-keys";

interface SourcePaneProps {
  value: string;
  onChange: (value: string) => void;
  running: boolean;
  onTranslate: () => void;
  onStop: () => void;
}

/** 紙面の左(狭い幅では上)。原文の入力欄と、翻訳・停止のボタン。 */
export function SourcePane({
  value,
  onChange,
  running,
  onTranslate,
  onStop,
}: SourcePaneProps) {
  const { t } = useTranslation();
  const id = useId();
  const mac = isMacPlatform(navigator.platform);
  const modifier = mac ? "⌘" : "Ctrl";

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Label htmlFor={id} className="sr-only">
        {t("translate.sourceLabel")}
      </Label>
      <Textarea
        id={id}
        value={value}
        placeholder={t("translate.sourcePlaceholder")}
        className="min-h-28 flex-1 resize-none rounded-none border-0 bg-transparent px-4.5 py-3 text-base leading-relaxed field-sizing-fixed md:text-base dark:bg-transparent"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (shouldTranslateOnKeyDown(event.nativeEvent)) {
            event.preventDefault();
            if (!running) onTranslate();
          }
        }}
      />
      <div className="flex h-13 shrink-0 items-center justify-end gap-2 px-3">
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
            disabled={value.trim() === ""}
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
