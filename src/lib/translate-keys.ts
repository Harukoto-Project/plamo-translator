/** `keydown` のうち、判定に使う部分。 */
export interface TranslateKeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  /** 変換(IME)の最中か(`KeyboardEvent.isComposing`) */
  isComposing: boolean;
  /** 非推奨だが、変換中のキーは 229 になる(`isComposing` が偽でも) */
  keyCode: number;
}

/** 原文の入力欄でCtrl/Cmd+Enterを押したとき、翻訳を始めるか。変換を確定するEnterでは始めない。 */
export function shouldTranslateOnKeyDown(input: TranslateKeyInput): boolean {
  if (input.key !== "Enter") return false;
  if (input.isComposing || input.keyCode === 229) return false;
  return input.ctrlKey || input.metaKey;
}

/** 実行環境がmacOSか。ショートカットの表示(⌘ / Ctrl)の出し分けに使う。 */
export function isMacPlatform(platform: string): boolean {
  return /mac|iphone|ipad/i.test(platform);
}
