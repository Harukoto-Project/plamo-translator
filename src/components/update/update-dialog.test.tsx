import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateDialog } from "@/components/update/update-dialog";
import {
  checkForUpdate,
  type DownloadEvent,
  installUpdate,
  type Update,
} from "@/services/updater";

vi.mock("@/services/updater", () => ({
  checkForUpdate: vi.fn(),
  installUpdate: vi.fn(),
}));

const close = vi.fn().mockResolvedValue(undefined);
const update = {
  currentVersion: "0.1.0",
  version: "0.2.0",
  close,
} as unknown as Update;

function renderDialog(enabled = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UpdateDialog enabled={enabled} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(checkForUpdate).mockReset();
  vi.mocked(installUpdate).mockReset();
  close.mockClear();
});

describe("UpdateDialog", () => {
  it("新しいバージョンがあれば、現在と新しいバージョンを出す", async () => {
    vi.mocked(checkForUpdate).mockResolvedValue(update);
    renderDialog();

    expect(
      await screen.findByText("新しいバージョンがあります"),
    ).toBeInTheDocument();
    expect(screen.getByText(/v0\.1\.0からv0\.2\.0/)).toBeInTheDocument();
  });

  it("最新なら何も出さない", async () => {
    vi.mocked(checkForUpdate).mockResolvedValue(null);
    renderDialog();

    await waitFor(() => expect(checkForUpdate).toHaveBeenCalled());
    expect(
      screen.queryByText("新しいバージョンがあります"),
    ).not.toBeInTheDocument();
  });

  it("確認に失敗しても何も出さない(オフラインなど)", async () => {
    vi.mocked(checkForUpdate).mockRejectedValue(new Error("network"));
    renderDialog();

    await waitFor(() => expect(checkForUpdate).toHaveBeenCalled());
    expect(
      screen.queryByText("新しいバージョンがあります"),
    ).not.toBeInTheDocument();
  });

  it("無効のときは確認しない", () => {
    renderDialog(false);

    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it("「あとで」で閉じる", async () => {
    vi.mocked(checkForUpdate).mockResolvedValue(update);
    renderDialog();
    await screen.findByText("新しいバージョンがあります");

    await userEvent.click(screen.getByRole("button", { name: "あとで" }));

    await waitFor(() =>
      expect(
        screen.queryByText("新しいバージョンがあります"),
      ).not.toBeInTheDocument(),
    );
    expect(installUpdate).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it("「更新して再起動」でインストールを始め、進み具合を出す", async () => {
    vi.mocked(checkForUpdate).mockResolvedValue(update);
    let emit: (event: DownloadEvent) => void = () => {};
    // 終わらないままにして、ダウンロード中の表示を見る
    vi.mocked(installUpdate).mockImplementation((_update, onEvent) => {
      emit = onEvent;
      return new Promise(() => {});
    });
    renderDialog();
    await screen.findByText("新しいバージョンがあります");

    await userEvent.click(
      screen.getByRole("button", { name: "更新して再起動" }),
    );
    await waitFor(() => expect(installUpdate).toHaveBeenCalled());
    expect(await screen.findByText("ダウンロード中")).toBeInTheDocument();

    emit({ event: "Started", data: { contentLength: 200 } });
    emit({ event: "Progress", data: { chunkLength: 100 } });

    expect(await screen.findByText("50%")).toBeInTheDocument();
    // ダウンロード中は閉じたり、二重に始めたりできない
    expect(screen.getByRole("button", { name: "あとで" })).toBeDisabled();
  });

  it("インストールに失敗したら理由を出し、もう一度試せる", async () => {
    vi.mocked(checkForUpdate).mockResolvedValue(update);
    vi.mocked(installUpdate).mockRejectedValue(new Error("署名が一致しません"));
    renderDialog();
    await screen.findByText("新しいバージョンがあります");

    await userEvent.click(
      screen.getByRole("button", { name: "更新して再起動" }),
    );

    expect(await screen.findByText(/署名が一致しません/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう一度試す" })).toBeEnabled();
  });
});
