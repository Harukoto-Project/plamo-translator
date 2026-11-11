import type { DownloadEvent } from "@tauri-apps/plugin-updater";

/** 更新のダウンロードの進み具合。 */
export interface DownloadProgress {
  /** ここまでに受け取ったバイト数 */
  downloaded: number;
  /** 全体のバイト数。サーバーが教えないときは `null` */
  total: number | null;
}

export const initialDownloadProgress: DownloadProgress = {
  downloaded: 0,
  total: null,
};

/** ダウンロードのイベントを1つ受けて、進み具合を更新する。 */
export function applyDownloadEvent(
  progress: DownloadProgress,
  event: DownloadEvent,
): DownloadProgress {
  switch (event.event) {
    case "Started":
      return { downloaded: 0, total: event.data.contentLength ?? null };
    case "Progress":
      return {
        ...progress,
        downloaded: progress.downloaded + event.data.chunkLength,
      };
    case "Finished":
      // 全体が分かっていれば、端数の誤差があっても100%で終わる
      return progress.total === null
        ? progress
        : { ...progress, downloaded: progress.total };
  }
}

/** 進み具合を0〜100の整数にする。全体が分からないあいだは `null`(不定の進捗表示にする)。 */
export function downloadPercent(progress: DownloadProgress): number | null {
  if (progress.total === null || progress.total <= 0) return null;
  const ratio = progress.downloaded / progress.total;
  return Math.min(100, Math.max(0, Math.floor(ratio * 100)));
}
