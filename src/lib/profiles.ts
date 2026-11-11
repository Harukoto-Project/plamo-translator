import type { ConnectionProfile, ProfileBook } from "@/types/bindings";

/** 使用中のプロファイル。IDが指すものが無ければ `undefined`。 */
export function activeProfile(
  book: ProfileBook,
): ConnectionProfile | undefined {
  return book.profiles.find((profile) => profile.id === book.activeId);
}

/**
 * モデルの選択肢。取得した一覧に、いま選んでいる名前が無ければ先頭に足す。
 * 空のモデル名(サーバーの既定)は選択肢にしない。
 */
export function modelOptions(
  models: readonly string[],
  current: string,
): string[] {
  const trimmed = current.trim();
  if (trimmed !== "" && !models.includes(trimmed)) {
    return [trimmed, ...models];
  }
  return [...models];
}
