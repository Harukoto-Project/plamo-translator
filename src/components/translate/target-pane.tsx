import { CheckIcon, CopyIcon, RotateCcwIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCopy } from "@/hooks/use-copy";
import type { TranslateState } from "@/lib/translate-state";
import { formatSpeed, tokensPerSecond } from "@/lib/translate-stats";

interface TargetPaneProps {
  state: TranslateState;
  /** 原文が空などで、再翻訳できないとき */
  retranslateDisabled: boolean;
  onRetranslate: () => void;
}

/** 訳文の表示欄。翻訳の進み具合・出力速度と、コピー・再翻訳の操作も出す。 */
export function TargetPane({
  state,
  retranslateDisabled,
  onRetranslate,
}: TargetPaneProps) {
  const { t } = useTranslation();
  const id = useId();
  const { status: copyStatus, copy } = useCopy();

  const speed = state.stats ? tokensPerSecond(state.stats) : undefined;
  const statsText =
    state.stats && speed !== undefined
      ? t(
          state.stats.estimated
            ? "translate.statsEstimated"
            : "translate.statsExact",
          { speed: formatSpeed(speed) },
        )
      : null;

  const finished = state.status !== "idle" && state.status !== "running";

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2">
      <Label htmlFor={id}>{t("translate.targetLabel")}</Label>
      <Textarea
        id={id}
        readOnly
        value={state.text}
        placeholder={t("translate.targetPlaceholder")}
        className="min-h-48 flex-1 resize-none bg-muted/30"
      />
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={state.text === ""}
            onClick={() => void copy(state.text)}
          >
            {copyStatus === "copied" ? (
              <CheckIcon aria-hidden="true" />
            ) : (
              <CopyIcon aria-hidden="true" />
            )}
            {copyStatus === "copied"
              ? t("translate.copied")
              : copyStatus === "failed"
                ? t("translate.copyFailed")
                : t("translate.copy")}
          </Button>
          {finished && (
            <Button
              variant="outline"
              size="sm"
              disabled={retranslateDisabled}
              onClick={onRetranslate}
            >
              <RotateCcwIcon aria-hidden="true" />
              {t("translate.retranslate")}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <p role="status">
            {state.status !== "idle" && t(`translate.status.${state.status}`)}
          </p>
          {statsText && <p>{statsText}</p>}
        </div>
      </div>
    </section>
  );
}
