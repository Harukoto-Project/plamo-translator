import { useCallback, useEffect, useReducer, useRef } from "react";
import { initialTranslateState, translateReducer } from "@/lib/translate-state";
import { toAppError } from "@/services/ipc";
import { cancelTranslation, startTranslation } from "@/services/translate";
import type { Lang } from "@/types/bindings";

/** 翻訳する内容。言語は、自動判定を済ませた値を渡す。 */
export interface TranslateInput {
  text: string;
  sourceLang: Lang;
  targetLang: Lang;
}

/**
 * 翻訳の進み具合と、開始・停止・消去の操作。入力(原文・言語)は持たない。
 * 進行はブロック単位で、`state.progress`(例: 3ブロック目 / 全12)に入る。
 */
export function useTranslator() {
  const [state, dispatch] = useReducer(translateReducer, initialTranslateState);

  /** 実行中のリクエストのID。古いリクエストのイベントを無視するのにも使う */
  const requestIdRef = useRef<string | null>(null);
  const running = state.status === "running";

  const translate = useCallback(
    (input: TranslateInput) => {
      if (running) return;
      if (input.text.trim() === "") return;

      const requestId = crypto.randomUUID();
      requestIdRef.current = requestId;
      dispatch({ type: "start" });
      startTranslation({ requestId, ...input }, (event) => {
        if (requestIdRef.current === requestId) {
          dispatch({ type: "event", event });
        }
      }).catch((error: unknown) => {
        if (requestIdRef.current === requestId) {
          dispatch({ type: "fail", error: toAppError(error) });
        }
      });
    },
    [running],
  );

  const stop = useCallback(() => {
    const requestId = requestIdRef.current;
    if (requestId === null || !running) return;
    dispatch({ type: "stop" });
    // 中断の失敗は、翻訳が既に終わっていた場合なので、無視してよい
    cancelTranslation(requestId).catch(() => undefined);
  }, [running]);

  /** 訳文などを消す。実行中は何もしない。 */
  const reset = useCallback(() => {
    if (running) return;
    requestIdRef.current = null;
    dispatch({ type: "reset" });
  }, [running]);

  // 画面を閉じるとき、実行中の翻訳をサーバーに続けさせない
  const runningRef = useRef(running);
  runningRef.current = running;
  useEffect(
    () => () => {
      const requestId = requestIdRef.current;
      if (requestId !== null && runningRef.current) {
        cancelTranslation(requestId).catch(() => undefined);
      }
    },
    [],
  );

  return { state, translate, stop, reset };
}
