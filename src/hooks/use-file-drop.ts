import { useCallback, useRef, useState } from "react";

/** ドラッグ中のものにファイルが含まれているか。 */
function hasFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export interface FileDropHandlers {
  onDragEnter: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

/**
 * 要素へのファイルのドロップ。
 *
 * Tauriのウィンドウは `dragDropEnabled: false` にして、HTML5の `drop` を受けている
 * (Windowsでは既定のままだとWebViewにドロップが届かない)。
 * 子要素を出入りするたびに `dragenter` / `dragleave` が来るので、深さを数えて判定する。
 * `disabled` の間は取り込まない。ファイルを開いてしまうのを防ぐため、イベント自体は止める。
 */
export function useFileDrop(
  onFiles: (files: File[]) => void,
  disabled = false,
) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const onDragEnter = useCallback(
    (event: React.DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (disabled) return;
      depth.current += 1;
      setDragging(true);
    },
    [disabled],
  );

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    },
    [disabled],
  );

  const onDragLeave = useCallback((event: React.DragEvent) => {
    if (!hasFiles(event)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (disabled) return;
      onFiles(Array.from(event.dataTransfer.files));
    },
    [disabled, onFiles],
  );

  const handlers: FileDropHandlers = {
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  };

  return {
    dragging: dragging && !disabled,
    handlers,
  };
}
