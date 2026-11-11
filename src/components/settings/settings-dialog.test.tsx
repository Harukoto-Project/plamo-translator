import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { AppCommandError } from "@/services/ipc";
import { listModels } from "@/services/models";
import {
  addProfile,
  getProfiles,
  removeProfile,
  setActiveProfile,
  updateProfile,
} from "@/services/profiles";
import {
  clearApiKey,
  getApiKeyStatus,
  getSettings,
  setApiKey,
  updateMaxTokens,
} from "@/services/settings";
import type { ProfileBook } from "@/types/bindings";

vi.mock("@/services/settings", () => ({
  getSettings: vi.fn(),
  updateMaxTokens: vi.fn(),
  getApiKeyStatus: vi.fn(),
  setApiKey: vi.fn(),
  clearApiKey: vi.fn(),
}));

vi.mock("@/services/profiles", () => ({
  getProfiles: vi.fn(),
  updateProfile: vi.fn(),
  addProfile: vi.fn(),
  removeProfile: vi.fn(),
  setActiveProfile: vi.fn(),
  selectModel: vi.fn(),
}));

vi.mock("@/services/models", () => ({
  listModels: vi.fn(),
}));

const profile = {
  id: "default",
  name: "vLLM",
  baseUrl: "http://localhost:8000/v1",
  model: "pfnet/plamo-2-translate",
};

const book: ProfileBook = { activeId: "default", profiles: [profile] };

const saved = {
  connection: { baseUrl: profile.baseUrl, model: profile.model },
  generation: { maxTokens: 1024 },
  profiles: book,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSettings).mockResolvedValue(saved);
  vi.mocked(getProfiles).mockResolvedValue(book);
  vi.mocked(getApiKeyStatus).mockResolvedValue("unset");
  vi.mocked(listModels).mockResolvedValue([]);
  vi.mocked(updateProfile).mockImplementation(async (next) => ({
    activeId: next.id,
    profiles: [next],
  }));
  vi.mocked(updateMaxTokens).mockImplementation(async (maxTokens) => ({
    ...saved,
    generation: { maxTokens },
  }));
  vi.mocked(setApiKey).mockResolvedValue("saved");
  vi.mocked(clearApiKey).mockResolvedValue("unset");
  vi.mocked(setActiveProfile).mockResolvedValue(book);
});

async function openDialog() {
  const user = userEvent.setup();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SettingsDialog />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("button", { name: "設定" }));
  await screen.findByLabelText("接続先URL");
  return user;
}

describe("SettingsDialog", () => {
  it("開くと、使用中の接続先と最大出力トークン数が入っている", async () => {
    await openDialog();

    expect(screen.getByLabelText("名前")).toHaveValue("vLLM");
    expect(screen.getByLabelText("接続先URL")).toHaveValue(
      "http://localhost:8000/v1",
    );
    expect(screen.getByLabelText("モデル名")).toHaveValue(
      "pfnet/plamo-2-translate",
    );
    expect(screen.getByLabelText("最大出力トークン数")).toHaveValue("1024");
    expect(screen.getByLabelText("APIキー")).toHaveValue("");
    expect(screen.getByText("使用中")).toBeInTheDocument();
  });

  it("接続先と最大出力トークン数を保存する(キーは触らない)", async () => {
    const user = await openDialog();

    const url = screen.getByLabelText("接続先URL");
    await user.clear(url);
    await user.type(url, "http://192.168.0.5:8000/v1");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(updateProfile).toHaveBeenCalledWith({
      id: "default",
      name: "vLLM",
      baseUrl: "http://192.168.0.5:8000/v1",
      model: "pfnet/plamo-2-translate",
    });
    expect(updateMaxTokens).toHaveBeenCalledWith(1024);
    expect(setApiKey).not.toHaveBeenCalled();
    expect(clearApiKey).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(screen.queryByLabelText("接続先URL")).not.toBeInTheDocument(),
    );
  });

  it("APIキーを入力して保存すると、その接続先のキーを設定する", async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText("APIキー"), "secret-value");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await vi.waitFor(() =>
      expect(setApiKey).toHaveBeenCalledWith("default", "secret-value"),
    );
  });

  it("保存済みのキーは削除できる", async () => {
    vi.mocked(getApiKeyStatus).mockResolvedValue("saved");
    const user = await openDialog();

    await user.click(screen.getByRole("button", { name: "削除する" }));
    expect(screen.getByText("保存すると削除されます")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存" }));

    await vi.waitFor(() => expect(clearApiKey).toHaveBeenCalledWith("default"));
    expect(setApiKey).not.toHaveBeenCalled();
  });

  it("キーをストアに書けなかったときは、ダイアログを開いたまま警告する", async () => {
    vi.mocked(setApiKey).mockResolvedValue("unsaved");
    const user = await openDialog();

    await user.type(screen.getByLabelText("APIキー"), "secret-value");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText(/メモリにだけあります/)).toBeInTheDocument();
    expect(screen.getByLabelText("APIキー")).toBeInTheDocument();
  });

  it("最大出力トークン数が整数でなければ、保存しない", async () => {
    const user = await openDialog();

    const tokens = screen.getByLabelText("最大出力トークン数");
    await user.clear(tokens);
    await user.type(tokens, "abc");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("1以上の整数");
    expect(updateProfile).not.toHaveBeenCalled();
    expect(updateMaxTokens).not.toHaveBeenCalled();
  });

  it("保存が拒否されたら、理由を表示し、ダイアログは閉じない", async () => {
    vi.mocked(updateProfile).mockRejectedValue(
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
        <SettingsDialog />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "設定" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("設定を読み込めませんでした");
    expect(alert).toHaveTextContent("denied");
  });

  it("モデル一覧が取れなくても、名前を入力して保存できる", async () => {
    vi.mocked(listModels).mockRejectedValue(
      new AppCommandError({
        kind: "connectionFailed",
        url: "http://localhost:8000/v1",
      }),
    );
    const user = await openDialog();

    expect(
      await screen.findByText(/モデル一覧を取得できませんでした/),
    ).toBeInTheDocument();
    const model = screen.getByLabelText("モデル名");
    await user.clear(model);
    await user.type(model, "typed-model");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await vi.waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ model: "typed-model" }),
      ),
    );
  });

  it("接続先を追加すると、追加したものを編集できる", async () => {
    const added = {
      id: "p2",
      name: "vLLM 2",
      baseUrl: "http://localhost:8000/v1",
      model: "pfnet/plamo-2-translate",
    };
    const nextBook: ProfileBook = {
      activeId: "default",
      profiles: [profile, added],
    };
    vi.mocked(addProfile).mockImplementation(async () => {
      vi.mocked(getProfiles).mockResolvedValue(nextBook);
      return { id: "p2", book: nextBook };
    });
    const user = await openDialog();

    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(addProfile).toHaveBeenCalledWith("vllm");
    expect(await screen.findByDisplayValue("vLLM 2")).toBeInTheDocument();
    expect(screen.getByLabelText("接続先URL")).toHaveValue(
      "http://localhost:8000/v1",
    );
  });

  it("最後の接続先は削除できない", async () => {
    await openDialog();

    expect(
      screen.getByText("最後の接続先は削除できません。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "削除" }),
    ).not.toBeInTheDocument();
  });

  it("接続先が2件あるときは、確認したあと削除できる", async () => {
    const second = {
      id: "p2",
      name: "Ollama",
      baseUrl: "http://localhost:11434/v1",
      model: "m",
    };
    const two: ProfileBook = {
      activeId: "default",
      profiles: [profile, second],
    };
    vi.mocked(getProfiles).mockResolvedValue(two);
    vi.mocked(getSettings).mockResolvedValue({ ...saved, profiles: two });
    vi.mocked(removeProfile).mockImplementation(async () => {
      vi.mocked(getProfiles).mockResolvedValue(book);
      return book;
    });
    const user = await openDialog();

    await user.click(screen.getByRole("button", { name: /Ollama/ }));
    await user.click(screen.getByRole("button", { name: "削除" }));
    await user.click(screen.getByRole("button", { name: "削除する" }));

    await vi.waitFor(() => expect(removeProfile).toHaveBeenCalledWith("p2"));
  });

  it("使用中でない接続先は、使用するにできる", async () => {
    const second = {
      id: "p2",
      name: "Ollama",
      baseUrl: "http://localhost:11434/v1",
      model: "m",
    };
    const two: ProfileBook = {
      activeId: "default",
      profiles: [profile, second],
    };
    vi.mocked(getProfiles).mockResolvedValue(two);
    vi.mocked(getSettings).mockResolvedValue({ ...saved, profiles: two });
    const user = await openDialog();

    await user.click(screen.getByRole("button", { name: /Ollama/ }));
    await user.click(await screen.findByRole("button", { name: "使用する" }));

    expect(setActiveProfile).toHaveBeenCalledWith("p2");
  });
});
