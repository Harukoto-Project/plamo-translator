import { type ResolvedSettings, resolveSettings } from "@/lib/settings";
import { unwrap } from "@/services/ipc";
import { commands, type KeyStatus } from "@/types/bindings";

/** 保存されている設定。 */
export async function getSettings(): Promise<ResolvedSettings> {
  return resolveSettings(await unwrap(commands.settingsGet()));
}

/** 設定を保存する。保存した内容(URLなどを整えたもの)を返す。 */
export async function updateSettings(
  settings: ResolvedSettings,
): Promise<ResolvedSettings> {
  return resolveSettings(await unwrap(commands.settingsUpdate(settings)));
}

/** APIキーを設定する(空なら削除)。キーの値は、この関数の外には残さない。 */
export function setApiKey(value: string): Promise<KeyStatus> {
  return unwrap(commands.secretSet(value));
}

export function clearApiKey(): Promise<KeyStatus> {
  return unwrap(commands.secretClear());
}

/** APIキーの状態。キーの値は取得できない。 */
export function getApiKeyStatus(): Promise<KeyStatus> {
  return unwrap(commands.secretStatus());
}
