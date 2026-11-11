import { type ResolvedSettings, resolveSettings } from "@/lib/settings";
import { unwrap } from "@/services/ipc";
import { commands, type KeyStatus } from "@/types/bindings";

/** 保存されている設定。 */
export async function getSettings(): Promise<ResolvedSettings> {
  return resolveSettings(await unwrap(commands.settingsGet()));
}

/**
 * 最大出力トークン数だけを保存する。
 *
 * 読み込んだ `generation` を広げてから渡すので、あとから足された項目を落とさない。
 * 接続先はプロファイルのコマンドが保存する。
 */
export async function updateMaxTokens(
  maxTokens: number,
): Promise<ResolvedSettings> {
  const current = await getSettings();
  return resolveSettings(
    await unwrap(
      commands.settingsUpdate({
        ...current,
        generation: { ...current.generation, maxTokens },
      }),
    ),
  );
}

/** プロファイルのAPIキーを設定する(空なら削除)。キーの値は、この関数の外には残さない。 */
export function setApiKey(
  profileId: string,
  value: string,
): Promise<KeyStatus> {
  return unwrap(commands.secretSet(profileId, value));
}

export function clearApiKey(profileId: string): Promise<KeyStatus> {
  return unwrap(commands.secretClear(profileId));
}

/** プロファイルのAPIキーの状態。キーの値は取得できない。 */
export function getApiKeyStatus(profileId: string): Promise<KeyStatus> {
  return unwrap(commands.secretStatus(profileId));
}
