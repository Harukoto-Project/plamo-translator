import { useTranslation } from "react-i18next";
import type { TranslateState } from "@/lib/translate-state";
import { formatSpeed, tokensPerSecond } from "@/lib/translate-stats";
import { cn } from "@/lib/utils";

interface TranslateStatusProps {
  state: TranslateState;
}

/** 翻訳の状態と出力速度。翻訳中は、点の明滅で動いていることを示す。 */
export function TranslateStatus({ state }: TranslateStatusProps) {
  const { t } = useTranslation();

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
  const progress = state.progress;
  const progressText =
    progress && progress.current > 0 && progress.total > 0
      ? t("translate.progress", {
          current: progress.current,
          total: progress.total,
        })
      : null;

  return (
    <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
      {state.status === "running" && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-foreground motion-safe:animate-pulse"
        />
      )}
      <p
        role="status"
        className={cn(
          "flex min-w-0 items-baseline gap-2",
          state.status === "error" && "text-destructive",
        )}
      >
        <span className="truncate">
          {state.status !== "idle" && t(`translate.status.${state.status}`)}
        </span>
        {progressText && (
          <span className="shrink-0 tabular-nums">{progressText}</span>
        )}
      </p>
      {statsText && <p className="shrink-0 tabular-nums">{statsText}</p>}
    </div>
  );
}
