import type { Lang } from "@/types/bindings";

/**
 * 翻訳の言語の一覧(選択肢の順)。表示名は `i18n` の `languages.<id>`。
 * 言語を足すときは、Rust の `Lang` と、ここと、文言ファイルに足す。
 */
export const languages = ["ja", "en", "ko"] as const satisfies readonly Lang[];

/** 原文の言語の初期値。 */
export const defaultSourceLang: Lang = "ja";
/** 訳文の言語の初期値。 */
export const defaultTargetLang: Lang = "en";

export function isLang(value: unknown): value is Lang {
  return (languages as readonly unknown[]).includes(value);
}

export interface LangPair {
  source: Lang;
  target: Lang;
}

/**
 * 原文の言語を変える。訳文と同じ言語を選んだら、訳文は元の原文の言語に入れ替える
 * (同じ言語どうしの翻訳は意味がないので、そうならないようにする)。
 */
export function changeSourceLang(pair: LangPair, next: Lang): LangPair {
  return next === pair.target
    ? { source: next, target: pair.source }
    : { source: next, target: pair.target };
}

/** 訳文の言語を変える。原文と同じ言語を選んだら、原文は元の訳文の言語に入れ替える。 */
export function changeTargetLang(pair: LangPair, next: Lang): LangPair {
  return next === pair.source
    ? { source: pair.target, target: next }
    : { source: pair.source, target: next };
}
