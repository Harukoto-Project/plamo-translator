import { describe, expect, it } from "vitest";
import {
  initialTranslateState,
  type TranslateAction,
  type TranslateState,
  translateReducer,
} from "@/lib/translate-state";

function run(...actions: TranslateAction[]): TranslateState {
  return actions.reduce(translateReducer, initialTranslateState);
}

const delta = (text: string): TranslateAction => ({
  type: "event",
  event: { type: "delta", text },
});

describe("translateReducer", () => {
  it("開始すると実行中になり、前の訳文などは消える", () => {
    const state = run(
      { type: "start" },
      delta("old"),
      { type: "event", event: { type: "done" } },
      { type: "start" },
    );
    expect(state.status).toBe("running");
    expect(state.text).toBe("");
    expect(state.warnings).toEqual([]);
    expect(state.stats).toBeNull();
  });

  it("訳文の増分をつなげていき、完了で done になる", () => {
    const state = run({ type: "start" }, delta("Hel"), delta("lo"), {
      type: "event",
      event: { type: "done" },
    });
    expect(state.text).toBe("Hello");
    expect(state.status).toBe("done");
  });

  it("停止を押したあとの完了は、stopped になり、それまでの訳文は残る", () => {
    const state = run(
      { type: "start" },
      delta("Hel"),
      { type: "stop" },
      {
        type: "event",
        event: { type: "done" },
      },
    );
    expect(state.status).toBe("stopped");
    expect(state.text).toBe("Hel");
  });

  it("警告は同じものを重ねない", () => {
    const warn = (warning: "delimiterRemoved" | "outputTruncated") =>
      ({ type: "event", event: { type: "warning", warning } }) as const;
    const state = run(
      { type: "start" },
      warn("delimiterRemoved"),
      warn("delimiterRemoved"),
      warn("outputTruncated"),
    );
    expect(state.warnings).toEqual(["delimiterRemoved", "outputTruncated"]);
  });

  it("ブロックの進行は、いまの番号(1から)と総数を持つ", () => {
    const state = run(
      { type: "start" },
      { type: "event", event: { type: "plan", chunks: 12 } },
      { type: "event", event: { type: "chunkStart", index: 2 } },
      { type: "event", event: { type: "chunkDone", index: 2 } },
    );
    expect(state.progress).toEqual({ current: 3, total: 12 });
    expect(state.status).toBe("running");
  });

  it("中断・エラーのあとも、そこまでの進行と訳文は残る", () => {
    const stopped = run(
      { type: "start" },
      { type: "event", event: { type: "plan", chunks: 4 } },
      { type: "event", event: { type: "chunkStart", index: 1 } },
      delta("途中"),
      { type: "stop" },
      { type: "event", event: { type: "done" } },
    );
    expect(stopped.status).toBe("stopped");
    expect(stopped.text).toBe("途中");
    expect(stopped.progress).toEqual({ current: 2, total: 4 });

    const failed = run(
      { type: "start" },
      { type: "event", event: { type: "plan", chunks: 4 } },
      { type: "event", event: { type: "chunkStart", index: 0 } },
      delta("A"),
      { type: "event", event: { type: "error", error: { kind: "timeout" } } },
    );
    expect(failed.status).toBe("error");
    expect(failed.text).toBe("A");
    expect(failed.progress).toEqual({ current: 1, total: 4 });
  });

  it("速度のイベントを保持する", () => {
    const stats = { tokens: 10, elapsedMs: 500, estimated: false };
    const state = run(
      { type: "start" },
      {
        type: "event",
        event: { type: "stats", stats },
      },
    );
    expect(state.stats).toEqual(stats);
  });

  it("エラーのイベントで error になり、それまでの訳文は残る", () => {
    const error = { kind: "timeout" } as const;
    const state = run({ type: "start" }, delta("Hel"), {
      type: "event",
      event: { type: "error", error },
    });
    expect(state.status).toBe("error");
    expect(state.error).toEqual(error);
    expect(state.text).toBe("Hel");
  });

  it("イベントを待たずに失敗したときも error になる", () => {
    const error = { kind: "internal", detail: "x" } as const;
    const state = run({ type: "start" }, { type: "fail", error });
    expect(state.status).toBe("error");
    expect(state.error).toEqual(error);
  });

  it("リセットすると、訳文などを消して最初の状態に戻る", () => {
    const state = run(
      { type: "start" },
      delta("Hel"),
      { type: "event", event: { type: "done" } },
      { type: "reset" },
    );
    expect(state).toEqual(initialTranslateState);
  });

  it("実行中は、リセットしない", () => {
    const running = run({ type: "start" }, delta("Hel"));
    expect(translateReducer(running, { type: "reset" })).toBe(running);
  });

  it("実行中でないときに届いたイベントは無視する", () => {
    expect(run(delta("late"))).toEqual(initialTranslateState);

    const finished = run(
      { type: "start" },
      { type: "event", event: { type: "done" } },
    );
    expect(translateReducer(finished, delta("late"))).toBe(finished);
    expect(translateReducer(finished, { type: "stop" })).toBe(finished);
    expect(
      translateReducer(finished, { type: "fail", error: { kind: "timeout" } }),
    ).toBe(finished);
  });
});
