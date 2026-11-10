import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultLanguage, defaultNamespace, resources } from "@/i18n/resources";

// 文言はバンドルに含めて同期で初期化する(読み込み待ちで画面が空にならない)
void i18n.use(initReactI18next).init({
  resources,
  lng: defaultLanguage,
  fallbackLng: defaultLanguage,
  defaultNS: defaultNamespace,
  // React が値をエスケープするため、i18next 側では行わない
  interpolation: { escapeValue: false },
});

export default i18n;
