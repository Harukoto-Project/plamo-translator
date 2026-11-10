//! ストリームの出力速度(tokens/s)の計測。

use std::time::{Duration, Instant};

use serde::Serialize;
use specta::Type;

/// これより短い時間では、速度が安定して測れないので統計を出さない。
const MIN_ELAPSED: Duration = Duration::from_millis(100);

/// 1回の翻訳の出力の統計。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ReplyStats {
    /// 出力したトークン数
    pub tokens: u32,
    /// 最初の出力から最後の出力までの時間(ミリ秒)
    pub elapsed_ms: u32,
    /// サーバーがトークン数を返さず、受け取ったデータの数で代用したか
    pub estimated: bool,
}

/// 1回の返答のあいだ、出力の届いた時刻と数を集める。
#[derive(Debug, Default)]
pub struct StreamStats {
    first: Option<Instant>,
    last: Option<Instant>,
    /// 出力を含んでいたデータの数。サーバーが数を返さないときの代わりにする
    outputs: u32,
    /// サーバーが返した出力トークン数
    reported_tokens: Option<u32>,
}

impl StreamStats {
    /// 出力が届いたことを記録する。
    pub fn record_output(&mut self, now: Instant) {
        self.first.get_or_insert(now);
        self.last = Some(now);
        self.outputs = self.outputs.saturating_add(1);
    }

    /// サーバーが返したトークン数を記録する。
    pub fn record_usage(&mut self, tokens: u64) {
        self.reported_tokens = Some(u32::try_from(tokens).unwrap_or(u32::MAX));
    }

    /// 統計。出力が無い・時間が短すぎるときは `None`。
    pub fn finish(self) -> Option<ReplyStats> {
        let elapsed = self.last?.duration_since(self.first?);
        if elapsed < MIN_ELAPSED {
            return None;
        }
        let reported = self.reported_tokens.filter(|tokens| *tokens > 0);
        Some(ReplyStats {
            tokens: reported.unwrap_or(self.outputs),
            elapsed_ms: u32::try_from(elapsed.as_millis()).unwrap_or(u32::MAX),
            estimated: reported.is_none(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stats_over(ms: u64, outputs: u32) -> StreamStats {
        let start = Instant::now();
        let mut stats = StreamStats::default();
        stats.record_output(start);
        for _ in 1..outputs {
            stats.record_output(start + Duration::from_millis(ms));
        }
        stats
    }

    #[test]
    fn no_output_has_no_stats() {
        assert_eq!(StreamStats::default().finish(), None);
    }

    #[test]
    fn a_too_short_interval_has_no_stats() {
        assert_eq!(stats_over(50, 3).finish(), None);
    }

    #[test]
    fn the_reported_tokens_win_over_the_count_of_outputs() {
        let mut stats = stats_over(2000, 10);
        stats.record_usage(40);

        assert_eq!(
            stats.finish(),
            Some(ReplyStats {
                tokens: 40,
                elapsed_ms: 2000,
                estimated: false,
            })
        );
    }

    #[test]
    fn without_a_report_the_outputs_are_counted_and_marked_as_estimated() {
        assert_eq!(
            stats_over(1000, 5).finish(),
            Some(ReplyStats {
                tokens: 5,
                elapsed_ms: 1000,
                estimated: true,
            })
        );
    }

    #[test]
    fn a_reported_zero_falls_back_to_the_count() {
        let mut stats = stats_over(1000, 4);
        stats.record_usage(0);

        assert!(matches!(
            stats.finish(),
            Some(ReplyStats {
                tokens: 4,
                estimated: true,
                ..
            })
        ));
    }
}
