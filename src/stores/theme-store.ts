import { create } from "zustand";
import type { ThemePreference } from "@/lib/theme";

type ThemeState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

/**
 * テーマの選択。永続化は設定ページ(③)で Rust の設定ファイルに移す。
 * それまでは OS の設定に従う。
 */
export const useThemeStore = create<ThemeState>((set) => ({
  preference: "system",
  setPreference: (preference) => set({ preference }),
}));
