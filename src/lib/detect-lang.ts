import type { Lang } from "@/types/bindings";

/** 日本語か韓国語と見なす、文字の割合の下限(文字 = 文字の種類が「文字」のもの。空白・数字・記号は数えない) */
const MIN_CJK_RATIO = 0.25;
/** 漢字だけの文(かなもハングルもない)を日本語と見なす、漢字の割合の下限 */
const MIN_HAN_ONLY_RATIO = 0.5;
/** 英語と見なす、ラテン文字の割合の下限 */
const MIN_LATIN_RATIO = 0.5;

/** 長音符(ー)は、文字の系統が「共通」なので、かなとして別に数える */
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}\u30FC]/u;
const HAN = /\p{Script=Han}/u;
const HANGUL = /\p{Script=Hangul}/u;
const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;

/**
 * 文章の言語を、文字の種類の割合から判定する。判定できなければ `undefined`(空・記号だけなど)。
 *
 * - かなを含み、かなと漢字の割合が高ければ日本語(英単語が混ざる日本語も、日本語になる)
 * - ハングルの割合が高ければ韓国語
 * - かなもハングルもなく、漢字が大半なら日本語(中国語は対象外なので、日本語に寄せる)
 * - ラテン文字が大半なら英語
 *
 * 日本語の固有名詞が混ざる英語(「I met 田中さん yesterday」)は、英語になる。
 */
export function detectLang(text: string): Lang | undefined {
  let total = 0;
  let kana = 0;
  let han = 0;
  let hangul = 0;
  let latin = 0;

  for (const char of text) {
    if (!LETTER.test(char)) continue;
    total += 1;
    if (KANA.test(char)) kana += 1;
    else if (HAN.test(char)) han += 1;
    else if (HANGUL.test(char)) hangul += 1;
    else if (LATIN.test(char)) latin += 1;
  }
  if (total === 0) return undefined;

  const jaRatio = kana > 0 ? (kana + han) / total : 0;
  const koRatio = hangul / total;
  if (jaRatio >= MIN_CJK_RATIO || koRatio >= MIN_CJK_RATIO) {
    return jaRatio >= koRatio ? "ja" : "ko";
  }
  if (han / total >= MIN_HAN_ONLY_RATIO) return "ja";
  if (latin / total >= MIN_LATIN_RATIO) return "en";
  return undefined;
}
