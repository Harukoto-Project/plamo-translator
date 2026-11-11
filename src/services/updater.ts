import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";

export type { DownloadEvent, Update };

/** 更新の確認が返ってくるまでの上限(ミリ秒)。起動時の確認が居座らないようにする。 */
const CHECK_TIMEOUT_MS = 30_000;

/** 新しいバージョンがあれば、その情報を返す。最新なら `null`。 */
export function checkForUpdate(): Promise<Update | null> {
  return check({ timeout: CHECK_TIMEOUT_MS });
}

/** 更新をダウンロードしてインストールし、アプリを再起動する。 */
export async function installUpdate(
  update: Update,
  onEvent: (event: DownloadEvent) => void,
): Promise<void> {
  await update.downloadAndInstall(onEvent);
  await relaunch();
}
