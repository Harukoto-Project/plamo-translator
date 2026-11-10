import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionDialog } from "@/components/settings/connection-dialog";
import { AppCommandError } from "@/services/ipc";
import {
  clearApiKey,
  getApiKeyStatus,
  getSettings,
  setApiKey,
  updateSettings,
} from "@/services/settings";

vi.mock("@/services/settings", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getApiKeyStatus: vi.fn(),
  setApiKey: vi.fn(),
  clearApiKey: vi.fn(),
}));

const saved = {
  connection: {
    baseUrl: "http://localhost:8000/v1",
    model: "pfnet/plamo-2-translate",
  },
  generation: { maxTokens: 1024 },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSettings).mockResolvedValue(saved);
  vi.mocked(getApiKeyStatus).mockResolvedValue("unset");
  vi.mocked(updateSettings).mockImplementation(async (settings) => settings);
  vi.mocked(setApiKey).mockResolvedValue("saved");
  vi.mocked(clearApiKey).mockResolvedValue("unset");
});

async function openDialog() {
  const user = userEvent.setup();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ConnectionDialog />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("button", { name: "接続設定" }));
  await screen.findByLabelText("接続先URL");
  return user;
}

describe("ConnectionDialog", () => {
  it("開くと、保存済みの設定が入力欄に入っている", async () => {
    await openDialog();

    expect(screen.getByLabelText("接続先URL")).toHaveValue(
      "http://localhost:8000/v1",
    );
    expect(screen.getByLabelText("モデル名")).toHaveValue(
      "pfnet/plamo-2-translate",
    );
    expect(screen.getByLabelText("最大出力トークン数")).toHaveValue("1024");
    expect(screen.getByLabelText("APIキー")).toHaveValue("");
  });

  it("設定を変えて保存すると、保存してダイアログを閉じる(キーは触らない)", async () => {
    const user = await openDialog();

    const url = screen.getByLabelText("接続先URL");
    await user.clear(url);
    await user.type(url, "http://192.168.0.5:8000/v1");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(updateSettings).toHaveBeenCalledWith({
      connection: {
        baseUrl: "http://192.168.0.5:8000/v1",
        model: "pfnet/plamo-2-translate",
      },
      generation: { maxTokens: 1024 },
    });
    expect(setApiKey).not.toHaveBeenCalled();
    expect(clearApiKey).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(screen.queryByLabelText("接続先URL")).not.toBeInTheDocument(),
    );
  });

  it("APIキーを入力して保存すると、キーを設定する", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("APIキー"), "secret-value");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await vi.waitFor(() =>
      expect(setApiKey).toHaveBeenCalledWith("secret-value"),
    );
  });

  it("保存済みのキーは削除できる", async () => {
    vi.mocked(getApiKeyStatus).mockResolvedValue("saved");
    const user = await openDialog();

    await user.click(screen.getByRole("button", { name: "削除する" }));
    expect(screen.getByText("保存すると削除されます")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存" }));

    await vi.waitFor(() => expect(clearApiKey).toHaveBeenCalled());
    expect(setApiKey).not.toHaveBeenCalled();
  });

  it("キー未設定のときは、削除ボタンを出さない", async () => {
    await openDialog();

    expect(
      screen.queryByRole("button", { name: "削除する" }),
    ).not.toBeInTheDocument();
  });

  it("最大出力トークン数が整数でなければ、保存せずにエラーを表示する", async () => {
    const user = await openDialog();

    const tokens = screen.getByLabelText("最大出力トークン数");
    await user.clear(tokens);
    await user.type(tokens, "abc");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("1以上の整数");
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("Rust が保存を拒否したら、理由を表示し、ダイアログは閉じない", async () => {
    vi.mocked(updateSettings).mockRejectedValue(
      new AppCommandError({ kind: "invalidUrl", reason: "malformed" }),
    );
    const user = await openDialog();

    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "URLの形式が正しくありません",
    );
    expect(screen.getByLabelText("接続先URL")).toBeInTheDocument();
  });

  it("設定を読み込めなかったら、理由を表示する", async () => {
    vi.mocked(getSettings).mockRejectedValue(
      new AppCommandError({ kind: "settingsReadFailed", detail: "denied" }),
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ConnectionDialog />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "接続設定" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("設定を読み込めませんでした");
    expect(alert).toHaveTextContent("denied");
  });
});
