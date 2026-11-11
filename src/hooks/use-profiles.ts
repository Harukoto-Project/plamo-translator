import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsKey } from "@/hooks/use-settings";
import {
  addProfile,
  getProfiles,
  removeProfile,
  selectModel,
  setActiveProfile,
  updateProfile,
} from "@/services/profiles";
import { clearApiKey, setApiKey, updateGeneration } from "@/services/settings";
import type {
  ConnectionProfile,
  KeyStatus,
  ProfilePreset,
} from "@/types/bindings";

export const profilesKey = ["profiles"] as const;

/** プロファイルの一覧。 */
export function useProfiles() {
  return useQuery({ queryKey: profilesKey, queryFn: getProfiles });
}

function useRefreshProfiles() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: profilesKey });
    void queryClient.invalidateQueries({ queryKey: settingsKey });
    void queryClient.invalidateQueries({ queryKey: ["api-key-status"] });
    void queryClient.invalidateQueries({ queryKey: ["models"] });
  };
}

/** APIキーをどうするか。値は保存するときだけ渡し、状態には残さない。 */
export type KeyChange =
  | { type: "keep" }
  | { type: "set"; value: string }
  | { type: "clear" };

export interface SaveProfileInput {
  profile: ConnectionProfile;
  maxTokens: number;
  chunkBudget: number;
  keyChange: KeyChange;
}

/**
 * 編集中のプロファイルと、全体の生成設定を保存する。
 * キーを変えたときは、その状態を返す(`unsaved` なら画面を閉じない)。
 */
export function useSaveProfile() {
  const refresh = useRefreshProfiles();
  return useMutation({
    mutationFn: async ({
      profile,
      maxTokens,
      chunkBudget,
      keyChange,
    }: SaveProfileInput): Promise<KeyStatus | null> => {
      await updateProfile(profile);
      let status: KeyStatus | null = null;
      if (keyChange.type === "set") {
        status = await setApiKey(profile.id, keyChange.value);
      } else if (keyChange.type === "clear") {
        status = await clearApiKey(profile.id);
      }
      await updateGeneration({ maxTokens, chunkBudget });
      return status;
    },
    onSettled: refresh,
  });
}

/** 雛形からプロファイルを追加する。 */
export function useAddProfile() {
  const refresh = useRefreshProfiles();
  return useMutation({
    mutationFn: (preset: ProfilePreset) => addProfile(preset),
    onSettled: refresh,
  });
}

/** プロファイルを削除する。 */
export function useRemoveProfile() {
  const refresh = useRefreshProfiles();
  return useMutation({
    mutationFn: (profileId: string) => removeProfile(profileId),
    onSettled: refresh,
  });
}

/** 使用中のプロファイルを切り替える。 */
export function useSetActiveProfile() {
  const refresh = useRefreshProfiles();
  return useMutation({
    mutationFn: (profileId: string) => setActiveProfile(profileId),
    onSettled: refresh,
  });
}

/** モデルを選び、そのプロファイルを使用中にする。 */
export function useSelectModel() {
  const refresh = useRefreshProfiles();
  return useMutation({
    mutationFn: (input: { profileId: string; model: string }) =>
      selectModel(input.profileId, input.model),
    onSettled: refresh,
  });
}
