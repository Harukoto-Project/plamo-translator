import type { Lang } from "@/types/bindings";

/**
 * 翻訳の言語の一覧(選択肢の順)。表示名は `i18n` の `languages.<id>`。
 * 言語を足すときは、Rust の `Lang` と、ここと、文言ファイルに足す。
 */
export const languages = ["ja", "en", "ko"] as const satisfies readonly Lang[];

/** 原文の言語の選択。`auto` は、原文から判定する(Rust には判定した結果を渡す)。 */
export type SourceChoice = Lang | "auto";

/** 原文の言語の選択肢の値(`auto` と、各言語) */
export const sourceChoices: readonly SourceChoice[] = ["auto", ...languages];

/** 自動判定できないときの、原文の言語の初期値。 */
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

/** 原文と同じ言語になったときに、訳文に使う言語(日本語なら英語、それ以外は日本語)。 */
export function fallbackTargetFor(source: Lang): Lang {
  return source === "ja" ? "en" : "ja";
}

export interface ResolveInput {
  choice: SourceChoice;
  /** 訳文の言語の設定 */
  target: Lang;
  /** 原文から判定した言語。判定できなければ `undefined` */
  detected: Lang | undefined;
  /** 判定できないときに使う、直前の原文の言語 */
  fallback: Lang;
}

/**
 * 選択から、実際に翻訳に使う言語を決める。
 * 原文が `auto` なら判定した言語(判定できなければ直前の言語)。
 * 訳文が原文と同じ言語になるときは、訳文を `fallbackTargetFor` に切り替える(設定は変えない)。
 */
export function resolveLanguages(input: ResolveInput): LangPair {
  const source =
    input.choice === "auto" ? (input.detected ?? input.fallback) : input.choice;
  return {
    source,
    target: source === input.target ? fallbackTargetFor(source) : input.target,
  };
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
