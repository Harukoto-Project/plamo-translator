import type { ComponentType } from "react";
import { TranslatePage } from "@/pages/translate/translate-page";

/** 画面の登録リスト。画面を足すときはここに1件追加する。 */
export const pages = {
  translate: TranslatePage,
} satisfies Record<string, ComponentType>;

export type PageId = keyof typeof pages;
