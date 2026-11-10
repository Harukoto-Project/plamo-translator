/** ユーザーが選ぶテーマ。`system` は OS の設定に従う。 */
export type ThemePreference = "system" | "light" | "dark";

/** 実際に適用されるテーマ。 */
export type ResolvedTheme = "light" | "dark";

/** 選択と OS の設定から、適用するテーマを決める。 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return preference;
}
