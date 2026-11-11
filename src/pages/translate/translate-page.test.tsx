import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranslatePage } from "@/pages/translate/translate-page";
import {
  deleteHistory,
  listHistory,
  loadHistory,
  saveHistory,
} from "@/services/history";
import { pickImportFile } from "@/services/import";
import { AppCommandError } from "@/services/ipc";
import { cancelTranslation, startTranslation } from "@/services/translate";
import type { TranslateEvent, TranslateRequest } from "@/types/bindings";

vi.mock("@/services/app", () => ({
  getAppInfo: vi
    .fn()
    .mockResolvedValue({ name: "plamo-translator", version: "9.9.9" }),
}));

vi.mock("@/services/import", () => ({
  pickImportFile: vi.fn().mockResolvedValue(null),
  importDroppedFile: vi.fn(),
}));

vi.mock("@/services/translate", () => ({
  startTranslation: vi.fn(),
  cancelTranslation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/history", () => ({
  listHistory: vi.fn().mockResolvedValue({ entries: [], skipped: 0 }),
  loadHistory: vi.fn(),
  saveHistory: vi.fn().mockResolvedValue({
    id: "saved",
    title: "こんにちは",
    createdAt: 1,
    updatedAt: 1,
  }),
  renameHistory: vi.fn(),
  deleteHistory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/settings", () => ({
  getSettings: vi.fn().mockResolvedValue({
    connection: { baseUrl: "http://localhost:8000/v1", model: "m" },
    generation: { maxTokens: 1024, chunkBudget: 1500 },
    profiles: {
      activeId: "default",
      profiles: [
        {
          id: "default",
          name: "vLLM",
          baseUrl: "http://localhost:8000/v1",
          model: "m",
        },
      ],
    },
  }),
  updateGeneration: vi.fn(),
  getApiKeyStatus: vi.fn().mockResolvedValue("unset"),
  setApiKey: vi.fn(),
  clearApiKey: vi.fn(),
}));

vi.mock("@/services/profiles", () => ({
  getProfiles: vi.fn().mockResolvedValue({
    activeId: "default",
    profiles: [
      {
        id: "default",
        name: "vLLM",
        baseUrl: "http://localhost:8000/v1",
        model: "m",
      },
    ],
  }),
  updateProfile: vi.fn(),
  addProfile: vi.fn(),
  removeProfile: vi.fn(),
  setActiveProfile: vi.fn(),
  selectModel: vi.fn(),
}));

vi.mock("@/services/models", () => ({
  listModels: vi.fn().mockResolvedValue([]),
}));

/** `startTranslation` の呼び出しを捕まえ、テストからイベントを流せるようにする。 */
function captureTranslation() {
  const captured: {
    request?: TranslateRequest;
    emit: (event: TranslateEvent) => void;
    finish: () => void;
  } = { emit: () => undefined, finish: () => undefined };

  vi.mocked(startTranslation).mockImplementation((request, onEvent) => {
    captured.request = request;
    captured.emit = (event) => act(() => onEvent(event));
    return new Promise<void>((resolve) => {
      captured.finish = resolve;
    });
  });
  return captured;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TranslatePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(startTranslation).mockReset();
  vi.mocked(cancelTranslation).mockClear();
  vi.mocked(saveHistory).mockClear();
  vi.mocked(listHistory).mockResolvedValue({ entries: [], skipped: 0 });
  vi.mocked(pickImportFile).mockReset();
  vi.mocked(pickImportFile).mockResolvedValue(null);
});

describe("TranslatePage", () => {
  it("見出しと、Rust から取得したバージョンを表示する", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "PLaMo Translator" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("plamo-translator v9.9.9"),
    ).toBeInTheDocument();
  });

  it("原文が空のあいだは、翻訳ボタンを押せない", async () => {
    const user = userEvent.setup();
    renderPage();

    const button = screen.getByRole("button", { name: "翻訳" });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    expect(button).toBeEnabled();
  });

  it("翻訳ボタンで翻訳を始め、訳文が少しずつ表示され、速度も出る", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));

    expect(captured.request).toMatchObject({
      sourceLang: "ja",
      targetLang: "en",
      text: "こんにちは",
    });
    expect(captured.request?.requestId).toBeTruthy();
    expect(await screen.findByRole("button", { name: "停止" })).toBeEnabled();

    captured.emit({ type: "delta", text: "Hel" });
    captured.emit({ type: "delta", text: "lo" });
    expect(screen.getByLabelText("訳文")).toHaveValue("Hello");
    expect(screen.getByRole("status")).toHaveTextContent("翻訳しています");

    captured.emit({
      type: "stats",
      stats: { tokens: 50, elapsedMs: 2000, estimated: false },
    });
    captured.emit({ type: "done" });
    captured.finish();

    expect(await screen.findByText("翻訳が完了しました")).toBeInTheDocument();
    expect(screen.getByText("25.0 tokens/s")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "翻訳" })).toBeEnabled();
  });

  it("Ctrl+Enter でも翻訳を始める", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(captured.request?.text).toBe("こんにちは");
  });

  it("翻訳ボタンはショートカットを示し、キーの表示は読み上げの名前に含めない", () => {
    renderPage();

    const button = screen.getByRole("button", { name: "翻訳" });
    expect(button).toHaveAttribute("aria-keyshortcuts", "Control+Enter");
    expect(button).toHaveTextContent("Ctrl");
  });

  it("Enter だけでは翻訳せず、改行する", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "1行目{Enter}2行目");

    expect(captured.request).toBeUndefined();
    expect(screen.getByLabelText("原文")).toHaveValue("1行目\n2行目");
  });

  it("停止を押すと中断を頼み、届いた分の訳文は残る", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));
    captured.emit({ type: "delta", text: "Hel" });

    await user.click(await screen.findByRole("button", { name: "停止" }));
    expect(cancelTranslation).toHaveBeenCalledWith(captured.request?.requestId);

    captured.emit({ type: "done" });
    captured.finish();

    expect(await screen.findByText("翻訳を停止しました")).toBeInTheDocument();
    expect(screen.getByLabelText("訳文")).toHaveValue("Hel");
  });

  it("ブロックの進行を表示し、失敗してもそこまでの訳文と進行は残る", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));
    captured.emit({ type: "plan", chunks: 12 });
    captured.emit({ type: "chunkStart", index: 2 });
    captured.emit({ type: "delta", text: "途中" });

    expect(screen.getByRole("status")).toHaveTextContent("3/12");
    expect(screen.getByLabelText("訳文")).toHaveValue("途中");

    captured.emit({ type: "error", error: { kind: "timeout" } });
    captured.finish();

    expect(await screen.findByRole("alert")).toHaveTextContent("タイムアウト");
    expect(screen.getByRole("status")).toHaveTextContent("3/12");
    expect(screen.getByLabelText("訳文")).toHaveValue("途中");
  });

  it("失敗したら、エラーを表示する", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));
    captured.emit({
      type: "error",
      error: { kind: "connectionFailed", url: "http://localhost:8000/v1" },
    });
    captured.finish();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("サーバーに接続できません");
    expect(alert).toHaveTextContent("http://localhost:8000/v1");
  });

  it("IPC の呼び出し自体が失敗しても、エラーを表示する", async () => {
    vi.mocked(startTranslation).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("警告を、エラーとは別に表示する", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));
    captured.emit({ type: "warning", warning: "outputTruncated" });
    captured.emit({ type: "delta", text: "Hi" });
    captured.emit({ type: "done" });
    captured.finish();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "最大出力トークン数に達した",
    );
    expect(screen.getByLabelText("訳文")).toHaveValue("Hi");
  });

  it("完了した翻訳だけを履歴に保存する", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));
    captured.emit({ type: "delta", text: "Hello" });
    captured.emit({ type: "done" });
    captured.finish();

    await waitFor(() => expect(saveHistory).toHaveBeenCalledTimes(1));
    expect(saveHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLang: "ja",
        targetLang: "en",
        sourceText: "こんにちは",
        targetText: "Hello",
        model: "m",
      }),
    );
  });

  it("停止した翻訳と、失敗した翻訳は履歴に保存しない", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));
    captured.emit({ type: "delta", text: "Hel" });
    await user.click(await screen.findByRole("button", { name: "停止" }));
    captured.emit({ type: "done" });
    captured.finish();
    await screen.findByText("翻訳を停止しました");
    expect(saveHistory).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "翻訳" }));
    captured.emit({ type: "error", error: { kind: "timeout" } });
    captured.finish();
    await screen.findByRole("alert");
    expect(saveHistory).not.toHaveBeenCalled();
  });

  it("履歴を開くと、原文・訳文・言語を戻し、再翻訳はしない", async () => {
    vi.mocked(listHistory).mockResolvedValue({
      entries: [
        {
          id: "h1",
          title: "保存した原文",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      skipped: 0,
    });
    vi.mocked(loadHistory).mockResolvedValue({
      id: "h1",
      title: "保存した原文",
      createdAt: 1,
      updatedAt: 1,
      sourceLang: "en",
      targetLang: "ja",
      sourceText: "Hello",
      targetText: "こんにちは",
      model: "m",
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "保存した原文" }),
    );

    expect(screen.getByLabelText("原文")).toHaveValue("Hello");
    expect(screen.getByLabelText("訳文")).toHaveValue("こんにちは");
    expect(
      screen.getByRole("combobox", { name: "原文の言語" }),
    ).toHaveTextContent("English");
    expect(
      screen.getByRole("combobox", { name: "訳文の言語" }),
    ).toHaveTextContent("日本語");
    expect(startTranslation).not.toHaveBeenCalled();
    expect(saveHistory).not.toHaveBeenCalled();
  });

  it("タイトルで履歴を絞り込む", async () => {
    vi.mocked(listHistory).mockResolvedValue({
      entries: [
        { id: "a", title: "京都の旅行", createdAt: 1, updatedAt: 2 },
        { id: "b", title: "天気の話", createdAt: 1, updatedAt: 1 },
      ],
      skipped: 0,
    });
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole("button", { name: "京都の旅行" }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByRole("searchbox", { name: "履歴を検索" }),
      "天気",
    );

    expect(
      screen.queryByRole("button", { name: "京都の旅行" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "天気の話" }),
    ).toBeInTheDocument();
  });

  it("新規にすると、原文と訳文を空にする", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));
    captured.emit({ type: "delta", text: "Hello" });
    captured.emit({ type: "done" });
    captured.finish();
    await screen.findByText("翻訳が完了しました");

    await user.click(screen.getByRole("button", { name: "新規" }));

    expect(screen.getByLabelText("原文")).toHaveValue("");
    expect(screen.getByLabelText("訳文")).toHaveValue("");
  });

  it("削除は確認してから行い、開いていた履歴の選択を外す", async () => {
    vi.mocked(listHistory).mockResolvedValue({
      entries: [{ id: "h1", title: "消す原文", createdAt: 1, updatedAt: 1 }],
      skipped: 0,
    });
    vi.mocked(loadHistory).mockResolvedValue({
      id: "h1",
      title: "消す原文",
      createdAt: 1,
      updatedAt: 1,
      sourceLang: "ja",
      targetLang: "en",
      sourceText: "あ",
      targetText: "a",
      model: "m",
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "消す原文" }));
    await user.click(
      screen.getByRole("button", { name: "「消す原文」を削除" }),
    );
    expect(deleteHistory).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => expect(deleteHistory).toHaveBeenCalledWith("h1"));
    expect(screen.getByLabelText("原文")).toHaveValue("あ");
  });

  it("画面を閉じたとき、実行中の翻訳を中断する", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    const { unmount } = renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));
    await waitFor(() => expect(captured.request).toBeDefined());

    unmount();
    expect(cancelTranslation).toHaveBeenCalledWith(captured.request?.requestId);
  });
});

const sourceSelect = () => screen.getByRole("combobox", { name: "原文の言語" });
const targetSelect = () => screen.getByRole("combobox", { name: "訳文の言語" });

/** 「こんにちは」を翻訳して、「Hello」が届いて完了した状態にする。 */
async function finishTranslation(
  captured: ReturnType<typeof captureTranslation>,
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(screen.getByLabelText("原文"), "こんにちは");
  await user.click(screen.getByRole("button", { name: "翻訳" }));
  captured.emit({ type: "delta", text: "Hello" });
  captured.emit({ type: "done" });
  captured.finish();
  await screen.findByText("翻訳が完了しました");
}

describe("TranslatePage の言語の選択", () => {
  it("原文の言語は初期値が「自動」で、入力すると判定した言語を表示する", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(sourceSelect()).toHaveTextContent("自動");
    expect(screen.queryByText(/を検出/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    expect(await screen.findByText("日本語を検出")).toBeInTheDocument();
    expect(sourceSelect()).toHaveTextContent("自動");
    expect(targetSelect()).toHaveTextContent("English");
  });

  it("判定した言語が訳文と同じなら、訳文の言語を切り替える", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "Hello, world");
    expect(await screen.findByText("Englishを検出")).toBeInTheDocument();
    expect(targetSelect()).toHaveTextContent("日本語");

    await user.click(screen.getByRole("button", { name: "翻訳" }));
    expect(captured.request).toMatchObject({
      sourceLang: "en",
      targetLang: "ja",
    });
  });

  it("入力してすぐ翻訳しても、最新の入力で判定した言語を使う", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "안녕하세요");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(captured.request).toMatchObject({
      sourceLang: "ko",
      targetLang: "en",
    });
  });

  it("判定できない入力(数字だけ)では、直前に判定した言語を使う", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    const source = screen.getByLabelText("原文");
    await user.type(source, "Hello");
    await screen.findByText("Englishを検出");
    await user.clear(source);
    await user.type(source, "12345");
    await user.click(screen.getByRole("button", { name: "翻訳" }));

    expect(captured.request).toMatchObject({
      sourceLang: "en",
      targetLang: "ja",
    });
  });

  it("原文の言語を手動で選ぶと、判定を使わない", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.click(sourceSelect());
    await user.click(await screen.findByRole("option", { name: "한국어" }));
    expect(sourceSelect()).toHaveTextContent("한국어");

    await user.type(screen.getByLabelText("原文"), "Hello");
    expect(screen.queryByText(/を検出/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "翻訳" }));

    expect(captured.request).toMatchObject({
      sourceLang: "ko",
      targetLang: "en",
    });
  });

  it("訳文に原文と同じ言語を選ぶと、原文が元の訳文の言語の手動選択になる", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await screen.findByText("日本語を検出");

    await user.click(targetSelect());
    await user.click(await screen.findByRole("option", { name: "日本語" }));

    expect(sourceSelect()).toHaveTextContent("English");
    expect(targetSelect()).toHaveTextContent("日本語");
  });
});

describe("TranslatePage の入れ替え・コピー・再翻訳", () => {
  it("入れ替えると、言語を入れ替え、訳文を原文欄に移して、訳文欄を空にする", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();
    await finishTranslation(captured, user);

    await user.click(
      screen.getByRole("button", { name: "言語と文章を入れ替える" }),
    );

    expect(screen.getByLabelText("原文")).toHaveValue("Hello");
    expect(screen.getByLabelText("訳文")).toHaveValue("");
    expect(sourceSelect()).toHaveTextContent("English");
    expect(targetSelect()).toHaveTextContent("日本語");
    expect(
      screen.queryByRole("button", { name: "再翻訳" }),
    ).not.toBeInTheDocument();
  });

  it("訳文がないときの入れ替えは、言語だけを入れ替える", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(
      screen.getByRole("button", { name: "言語と文章を入れ替える" }),
    );

    expect(screen.getByLabelText("原文")).toHaveValue("こんにちは");
    expect(sourceSelect()).toHaveTextContent("English");
    expect(targetSelect()).toHaveTextContent("日本語");
  });

  it("翻訳中は、入れ替えられない", async () => {
    captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));

    expect(
      screen.getByRole("button", { name: "言語と文章を入れ替える" }),
    ).toBeDisabled();
  });

  it("訳文がないあいだは、コピーを押せない", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "コピー" })).toBeDisabled();
  });

  it("コピーを押すと、訳文をクリップボードに入れる", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();
    await finishTranslation(captured, user);

    await user.click(screen.getByRole("button", { name: "コピー" }));

    expect(await navigator.clipboard.readText()).toBe("Hello");
    expect(
      await screen.findByRole("button", { name: "コピーしました" }),
    ).toBeInTheDocument();
  });

  it("コピーに失敗したら、失敗を表示する", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();
    await finishTranslation(captured, user);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );

    await user.click(screen.getByRole("button", { name: "コピー" }));

    expect(
      await screen.findByRole("button", { name: "コピーできませんでした" }),
    ).toBeInTheDocument();
  });

  it("再翻訳は、翻訳が終わるまで出ず、終わったら同じ原文・言語でもう一度翻訳する", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.queryByRole("button", { name: "再翻訳" }),
    ).not.toBeInTheDocument();
    await finishTranslation(captured, user);
    const first = captured.request;

    await user.click(screen.getByRole("button", { name: "再翻訳" }));

    expect(startTranslation).toHaveBeenCalledTimes(2);
    expect(captured.request).toMatchObject({
      text: "こんにちは",
      sourceLang: first?.sourceLang,
      targetLang: first?.targetLang,
    });
    expect(captured.request?.requestId).not.toBe(first?.requestId);
    expect(screen.getByLabelText("訳文")).toHaveValue("");
  });

  it("原文を空にすると、再翻訳は押せない", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();
    await finishTranslation(captured, user);

    await user.clear(screen.getByLabelText("原文"));

    expect(screen.getByRole("button", { name: "再翻訳" })).toBeDisabled();
  });

  it("ファイルを選ぶと、原文欄に展開する", async () => {
    const user = userEvent.setup();
    vi.mocked(pickImportFile).mockResolvedValue("取り込まれた文章");
    renderPage();

    await user.click(
      screen.getByRole("button", { name: "ファイルを取り込む" }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText("原文")).toHaveValue("取り込まれた文章");
    });
  });

  it("ファイルを取り込めなかったとき、種別の文言を出す", async () => {
    const user = userEvent.setup();
    vi.mocked(pickImportFile).mockRejectedValue(
      new AppCommandError({ kind: "pdfNoText" }),
    );
    renderPage();

    await user.click(
      screen.getByRole("button", { name: "ファイルを取り込む" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "スキャンした画像だけのPDFには対応していません",
    );
  });

  it("翻訳中は、ファイルを取り込めない", async () => {
    const captured = captureTranslation();
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("原文"), "こんにちは");
    await user.click(screen.getByRole("button", { name: "翻訳" }));

    expect(
      screen.getByRole("button", { name: "ファイルを取り込む" }),
    ).toBeDisabled();

    captured.emit({ type: "done" });
    captured.finish();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "ファイルを取り込む" }),
      ).toBeEnabled();
    });
  });
});
