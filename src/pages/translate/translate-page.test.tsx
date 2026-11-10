import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranslatePage } from "@/pages/translate/translate-page";
import { cancelTranslation, startTranslation } from "@/services/translate";
import type { TranslateEvent, TranslateRequest } from "@/types/bindings";

vi.mock("@/services/app", () => ({
  getAppInfo: vi
    .fn()
    .mockResolvedValue({ name: "plamo-translator", version: "9.9.9" }),
}));

vi.mock("@/services/translate", () => ({
  startTranslation: vi.fn(),
  cancelTranslation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/settings", () => ({
  getSettings: vi.fn().mockResolvedValue({
    connection: { baseUrl: "http://localhost:8000/v1", model: "m" },
    generation: { maxTokens: 1024 },
  }),
  updateSettings: vi.fn(),
  getApiKeyStatus: vi.fn().mockResolvedValue("unset"),
  setApiKey: vi.fn(),
  clearApiKey: vi.fn(),
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
