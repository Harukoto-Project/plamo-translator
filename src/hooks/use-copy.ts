import { useCallback, useEffect, useRef, useState } from "react";
import { copyText } from "@/services/clipboard";

export type CopyStatus = "idle" | "copied" | "failed";

/** コピーを実行し、結果(`copied` / `failed`)を一定時間だけ返す。 */
export function useCopy(resetAfterMs = 2000) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const copy = useCallback(
    async (text: string) => {
      clearTimer();
      try {
        await copyText(text);
        setStatus("copied");
      } catch {
        setStatus("failed");
      }
      timerRef.current = setTimeout(() => setStatus("idle"), resetAfterMs);
    },
    [clearTimer, resetAfterMs],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { status, copy };
}
