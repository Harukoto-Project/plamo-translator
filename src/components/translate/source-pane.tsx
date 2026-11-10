import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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

/** 原文の入力欄と、翻訳・停止のボタン。 */
export function SourcePane({
  value,
  onChange,
  running,
  onTranslate,
  onStop,
}: SourcePaneProps) {
  const { t } = useTranslation();
  const id = useId();
  const modifier = isMacPlatform(navigator.platform) ? "⌘" : "Ctrl";

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2">
      <Label htmlFor={id}>{t("translate.sourceLabel")}</Label>
      <Textarea
        id={id}
        value={value}
        placeholder={t("translate.sourcePlaceholder")}
        className="min-h-48 flex-1 resize-none"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (shouldTranslateOnKeyDown(event.nativeEvent)) {
            event.preventDefault();
            if (!running) onTranslate();
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t("translate.shortcut", { modifier })}
        </p>
        {running ? (
          <Button variant="outline" onClick={onStop}>
            {t("translate.stop")}
          </Button>
        ) : (
          <Button onClick={onTranslate} disabled={value.trim() === ""}>
            {t("translate.translate")}
          </Button>
        )}
      </div>
    </section>
  );
}
