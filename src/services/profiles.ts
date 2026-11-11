import { unwrap } from "@/services/ipc";
import {
  type ConnectionProfile,
  commands,
  type ProfileAdded,
  type ProfileBook,
  type ProfilePreset,
} from "@/types/bindings";

/** プロファイルの一覧。キーは含まない。 */
export function getProfiles(): Promise<ProfileBook> {
  return unwrap(commands.profilesGet());
}

/** 既存のプロファイルを保存する。 */
export function updateProfile(
  profile: ConnectionProfile,
): Promise<ProfileBook> {
  return unwrap(commands.profilesUpdate(profile));
}

/** 雛形からプロファイルを追加する。 */
export function addProfile(preset: ProfilePreset): Promise<ProfileAdded> {
  return unwrap(commands.profilesAdd(preset));
}

/** プロファイルを削除する。最後の1件は削除できない。 */
export function removeProfile(profileId: string): Promise<ProfileBook> {
  return unwrap(commands.profilesRemove(profileId));
}

/** 使用中のプロファイルを切り替える。 */
export function setActiveProfile(profileId: string): Promise<ProfileBook> {
  return unwrap(commands.profilesSetActive(profileId));
}

/** モデルを選び、そのプロファイルを使用中にする。 */
export function selectModel(
  profileId: string,
  model: string,
): Promise<ProfileBook> {
  return unwrap(commands.profilesSelectModel(profileId, model));
}
