import type { defaultNamespace, resources } from "@/i18n/resources";

// `t("...")` のキーを、日本語の文言の定義から型で補完・検査する
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNamespace;
    resources: (typeof resources)["ja"];
  }
}
