import { unwrap } from "@/services/ipc";
import { commands } from "@/types/bindings";

/** 保存済みのプロファイルの `/models` から、モデルIDの一覧を取る。 */
export function listModels(profileId: string): Promise<string[]> {
  return unwrap(commands.modelsList(profileId));
}
