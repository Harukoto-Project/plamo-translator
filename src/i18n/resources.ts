import { ja } from "@/i18n/locales/ja";

/** 利用できる言語と、その文言。言語を足すときはここに登録する。 */
export const resources = {
  ja: { translation: ja },
} as const;

export const defaultLanguage = "ja";
export const defaultNamespace = "translation";
