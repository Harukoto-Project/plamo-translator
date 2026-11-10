import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ResolvedSettings } from "@/lib/settings";
import {
  clearApiKey,
  getApiKeyStatus,
  getSettings,
  setApiKey,
  updateSettings,
} from "@/services/settings";

const settingsKey = ["settings"] as const;
const apiKeyStatusKey = ["api-key-status"] as const;

/** 保存されている設定。 */
export function useSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: getSettings });
}

/** APIキーの有無。キーの値は取得できない。 */
export function useApiKeyStatus() {
  return useQuery({ queryKey: apiKeyStatusKey, queryFn: getApiKeyStatus });
}

/** APIキーをどうするか。 */
export type KeyChange =
  | { type: "keep" }
  | { type: "set"; value: string }
  | { type: "clear" };

export interface SaveConnectionInput {
  settings: ResolvedSettings;
  keyChange: KeyChange;
}

/** 設定を保存し、必要ならAPIキーも更新する。 */
export function useSaveConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ settings, keyChange }: SaveConnectionInput) => {
      const saved = await updateSettings(settings);
      if (keyChange.type === "set") {
        await setApiKey(keyChange.value);
      } else if (keyChange.type === "clear") {
        await clearApiKey();
      }
      return saved;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKey });
      void queryClient.invalidateQueries({ queryKey: apiKeyStatusKey });
    },
  });
}
