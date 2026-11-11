import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFileDrop } from "@/hooks/use-file-drop";
import { errorForDroppedFiles } from "@/lib/import-file";
import { importDroppedFile, pickImportFile } from "@/services/import";
import { toAppError } from "@/services/ipc";
import type { AppError } from "@/types/bindings";

/**
 * ファイルを原文のテキストにして `onText` に渡す。
 * `disabled` の間(翻訳中など)は、ダイアログもドロップも受けない。
 */
export function useFileImport(
  onText: (text: string) => void,
  disabled = false,
) {
  const { t } = useTranslation();
  const [error, setError] = useState<AppError | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(
    async (work: () => Promise<void>) => {
      if (disabled || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        await work();
      } catch (caught) {
        setError(toAppError(caught));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [disabled],
  );

  const importFiles = useCallback(
    (files: File[]) => {
      if (disabled || busyRef.current) return;
      const early = errorForDroppedFiles(files);
      if (early) {
        setError(early);
        return;
      }
      const file = files[0];
      if (file === undefined) return;
      void run(async () => {
        onText(await importDroppedFile(file));
      });
    },
    [disabled, onText, run],
  );

  const drop = useFileDrop(importFiles, disabled || busy);

  const pick = useCallback(() => {
    return run(async () => {
      const text = await pickImportFile(t("import.dialogTitle"));
      if (text !== null) onText(text);
    });
  }, [onText, run, t]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    clearError,
    busy,
    dragging: drop.dragging,
    dropHandlers: drop.handlers,
    pick,
  };
}
