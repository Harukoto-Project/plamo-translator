import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { detectLang } from "@/lib/detect-lang";
import {
  changeSourceLang,
  changeTargetLang,
  defaultSourceLang,
  defaultTargetLang,
  type LangPair,
  resolveLanguages,
  type SourceChoice,
} from "@/lib/languages";
import type { Lang } from "@/types/bindings";

/** 入力が止まってから判定するまでの時間(ミリ秒)。1文字ごとに表示が揺れないようにする。 */
const DETECT_DELAY_MS = 250;

/**
 * 原文と訳文の言語の選択。原文は「自動」を選べ、その場合は `text` から判定する。
 * 画面に出す値(`shown`)は、入力が止まってから判定する。翻訳を始めるときは、最新の入力で `resolve` する。
 */
export function useLanguageSelection(text: string) {
  const [choice, setChoice] = useState<SourceChoice>("auto");
  const [target, setTarget] = useState<Lang>(defaultTargetLang);
  /** 判定できなかったとき(空・記号だけ)に使う、直前に判定できた言語 */
  const [lastDetected, setLastDetected] = useState<Lang>(defaultSourceLang);

  const debouncedText = useDebouncedValue(text, DETECT_DELAY_MS);
  const detected = useMemo(() => detectLang(debouncedText), [debouncedText]);
  useEffect(() => {
    if (detected !== undefined) setLastDetected(detected);
  }, [detected]);

  const shown = resolveLanguages({
    choice,
    target,
    detected,
    fallback: lastDetected,
  });

  /** 最新の入力で言語を決める(翻訳を始めるとき、入れ替えるときに使う)。 */
  const resolve = useCallback(
    (): LangPair =>
      resolveLanguages({
        choice,
        target,
        detected: detectLang(text),
        fallback: lastDetected,
      }),
    [choice, target, text, lastDetected],
  );

  const selectSource = (next: SourceChoice) => {
    if (next === "auto") {
      setChoice("auto");
      return;
    }
    const pair = changeSourceLang(shown, next);
    setChoice(pair.source);
    setTarget(pair.target);
  };

  const selectTarget = (next: Lang) => {
    const pair = changeTargetLang(shown, next);
    // 原文と同じ言語を選んだときだけ、原文が入れ替わる(手動の選択になる)
    if (pair.source !== shown.source) setChoice(pair.source);
    setTarget(pair.target);
  };

  /** 原文と訳文の言語を入れ替える。原文は、判定した言語を手動の選択にする。 */
  const swap = () => {
    const pair = resolve();
    setChoice(pair.target);
    setTarget(pair.source);
  };

  return {
    choice,
    /** 画面に出す、原文と訳文の言語 */
    shown,
    /** 原文が「自動」のときに、判定できた言語(判定できなければ `undefined`) */
    detected: choice === "auto" ? detected : undefined,
    selectSource,
    selectTarget,
    swap,
    resolve,
  };
}
