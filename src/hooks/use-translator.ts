import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { defaultSourceLang, defaultTargetLang } from "@/lib/languages";
import { initialTranslateState, translateReducer } from "@/lib/translate-state";
import { toAppError } from "@/services/ipc";
import { cancelTranslation, startTranslation } from "@/services/translate";
import type { Lang } from "@/types/bindings";

/** 翻訳画面の状態と操作。入力(原文・言語)と、翻訳の進み具合をまとめて持つ。 */
export function useTranslator() {
  const [sourceText, setSourceText] = useState("");
  const [sourceLang, setSourceLang] = useState<Lang>(defaultSourceLang);
  const [targetLang, setTargetLang] = useState<Lang>(defaultTargetLang);
  const [state, dispatch] = useReducer(translateReducer, initialTranslateState);

  /** 実行中のリクエストのID。古いリクエストのイベントを無視するのにも使う */
  const requestIdRef = useRef<string | null>(null);
  const running = state.status === "running";

  const translate = useCallback(() => {
    if (requestIdRef.current !== null && running) return;
    if (sourceText.trim() === "") return;

    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    dispatch({ type: "start" });
    startTranslation(
      { requestId, sourceLang, targetLang, text: sourceText },
      (event) => {
        if (requestIdRef.current === requestId) {
          dispatch({ type: "event", event });
        }
      },
    ).catch((error: unknown) => {
      if (requestIdRef.current === requestId) {
        dispatch({ type: "fail", error: toAppError(error) });
      }
    });
  }, [running, sourceText, sourceLang, targetLang]);

  const stop = useCallback(() => {
    const requestId = requestIdRef.current;
    if (requestId === null || !running) return;
    dispatch({ type: "stop" });
    // 中断の失敗は、翻訳が既に終わっていた場合なので、無視してよい
    cancelTranslation(requestId).catch(() => undefined);
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

  return {
    sourceText,
    setSourceText,
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    state,
    translate,
    stop,
  };
}
