import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TranslateState } from "@/lib/translate-state";
import { formatSpeed, tokensPerSecond } from "@/lib/translate-stats";

interface TargetPaneProps {
  state: TranslateState;
}

/** 訳文の表示欄。翻訳の進み具合と、出力速度も出す。 */
export function TargetPane({ state }: TargetPaneProps) {
  const { t } = useTranslation();
  const id = useId();

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
      <div className="flex min-h-9 items-center justify-between gap-2 text-xs text-muted-foreground">
        <p role="status">
          {state.status !== "idle" && t(`translate.status.${state.status}`)}
        </p>
        {statsText && <p>{statsText}</p>}
      </div>
    </section>
  );
}
