import { useEffect, useRef } from "react";
import { useSaveHistory } from "@/hooks/use-history";
import type { TranslateStatus } from "@/lib/translate-state";
import { toAppError } from "@/services/ipc";
import type { Lang } from "@/types/bindings";

/** 翻訳を始めるときに控えておき、完了したときだけ保存する内容。訳文は完了時のものを使う。 */
export interface TranslationDraft {
  id: string;
  sourceLang: Lang;
  targetLang: Lang;
  sourceText: string;
  model: string;
}

/**
 * 翻訳が完了(`done`で、停止でもエラーでもない)したときだけ履歴に保存する。
 * 画面が別の履歴へ移ったあとに保存が終わっても、選択中の履歴は変えない。
 */
export function useRecordTranslation(
  status: TranslateStatus,
  targetText: string,
  onRecorded: (id: string) => void,
) {
  const save = useSaveHistory();
  const draftRef = useRef<TranslationDraft | null>(null);
  /** 履歴を開く・新規にするたびに増やす。保存を始めた時点の値と違えば、選択は動かさない */
  const viewToken = useRef(0);
  const saveToken = useRef(0);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const arm = (draft: TranslationDraft) => {
    draftRef.current = draft;
    saveToken.current = viewToken.current;
  };

  /** 開いている翻訳が別のものに移った。進行中の保存は続けるが、選択中の履歴は上書きしない。 */
  const moveOn = () => {
    viewToken.current += 1;
  };

  useEffect(() => {
    if (status === "running" || status === "idle") return;
    const draft = draftRef.current;
    if (draft === null) return;
    draftRef.current = null;
    if (status !== "done" || targetText.trim() === "") return;

    const token = saveToken.current;
    save.mutate(
      { ...draft, targetText },
      {
        onSuccess: (saved) => {
          if (saved && token === viewToken.current) {
            onRecordedRef.current(saved.id);
          }
        },
      },
    );
  }, [status, targetText, save.mutate]);

  return {
    arm,
    moveOn,
    error: save.error ? toAppError(save.error) : null,
  };
}
