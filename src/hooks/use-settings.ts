import { useQuery } from "@tanstack/react-query";
import { getApiKeyStatus, getSettings } from "@/services/settings";

export const settingsKey = ["settings"] as const;

/** 保存されている設定。 */
export function useSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: getSettings });
}

/** プロファイルのAPIキーの有無。キーの値は取得できない。 */
export function useApiKeyStatus(profileId: string | undefined) {
  return useQuery({
    queryKey: ["api-key-status", profileId],
    queryFn: () => getApiKeyStatus(profileId ?? ""),
    enabled: profileId !== undefined && profileId !== "",
  });
}
