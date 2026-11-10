import type { ReplyStats } from "@/types/bindings";

/** 1秒あたりのトークン数。時間かトークン数が0以下なら `undefined`。 */
export function tokensPerSecond(stats: ReplyStats): number | undefined {
  if (stats.elapsedMs <= 0 || stats.tokens <= 0) return undefined;
  return stats.tokens / (stats.elapsedMs / 1000);
}

/** 画面に出す速度の数字。100以上は整数、それ未満は小数1桁(例: `42.3`、`120`)。 */
export function formatSpeed(speed: number): string {
  return speed.toFixed(speed >= 100 ? 0 : 1);
}
