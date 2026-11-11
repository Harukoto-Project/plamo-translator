import type {
  ConnectionSettings,
  GenerationSettings,
  ProfileBook,
  Settings,
} from "@/types/bindings";

/**
 * 項目が全て揃った設定。
 *
 * Rust の型は、保存ファイルに無い項目を既定値で補えるよう `#[serde(default)]` が付いていて、
 * 生成される TypeScript の型では項目が省略可能(`?`)になる。Rust は読み込み時に必ず補って返すので、
 * 画面では全て揃っているものとして扱う。
 *
 * `generation` は、あとから足される項目を落とさないよう、そのまま広げる。
 * 分割の文字数は `generation` にあり、プロファイルごとには持たない。
 */
export interface ResolvedSettings {
  connection: Required<ConnectionSettings>;
  generation: GenerationSettings & { maxTokens: number; chunkBudget: number };
  profiles: ProfileBook;
}

/**
 * 入力欄の文字を最大出力トークン数にする。1以上の整数でなければ `undefined`。
 * `Number()` は空文字を0、`"1e3"` を1000にするので使わず、数字だけの文字列に限る。
 * 上限(Rust の `MAX_MAX_TOKENS`)の判定は Rust に任せ、ここでは Rust が受け取れる
 * 型(`u32`)に収まるかだけを見る。
 */
export function parseMaxTokens(text: string): number | undefined {
  return parsePositiveInt(text, U32_MAX);
}

/** Rust の `MAX_CHUNK_BUDGET` と同じ。これを超える値は保存前に弾く。 */
export const MAX_CHUNK_BUDGET = 1_000_000;

/** 入力欄の文字を、分割の文字数(1以上100万以下)にする。 */
export function parseChunkBudget(text: string): number | undefined {
  return parsePositiveInt(text, MAX_CHUNK_BUDGET);
}

const U32_MAX = 4_294_967_295;

function parsePositiveInt(text: string, max: number): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value >= 1 && value <= max ? value : undefined;
}

/** Rust から受け取った設定を、全項目が揃った形にする。揃っていなければ例外(Rust 側の不具合)。 */
export function resolveSettings(settings: Settings): ResolvedSettings {
  const { baseUrl, model } = settings.connection ?? {};
  const generation = settings.generation ?? {};
  const { maxTokens, chunkBudget } = generation;
  if (
    baseUrl === undefined ||
    model === undefined ||
    maxTokens === undefined ||
    chunkBudget === undefined ||
    settings.profiles === undefined
  ) {
    throw new Error("Rust から受け取った設定に、欠けた項目があります");
  }
  return {
    connection: { baseUrl, model },
    generation: { ...generation, maxTokens, chunkBudget },
    profiles: settings.profiles,
  };
}
