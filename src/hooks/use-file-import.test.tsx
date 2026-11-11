import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileImport } from "@/hooks/use-file-import";
import { PDF_MAX_BYTES } from "@/lib/import-file";
import { importDroppedFile, pickImportFile } from "@/services/import";
import { AppCommandError } from "@/services/ipc";

vi.mock("@/services/import", () => ({
  pickImportFile: vi.fn(),
  importDroppedFile: vi.fn(),
}));

function Harness({
  onText,
  disabled = false,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const fileImport = useFileImport(onText, disabled);
  return (
    <div>
      <button type="button" onClick={fileImport.pick}>
        pick
      </button>
      <div data-testid="zone" {...fileImport.dropHandlers} />
      {fileImport.error && <p role="alert">{fileImport.error.kind}</p>}
    </div>
  );
}

function dropFiles(files: File[]) {
  fireEvent.drop(screen.getByTestId("zone"), {
    dataTransfer: {
      types: ["Files"],
      files,
      dropEffect: "none",
    },
  });
}

beforeEach(() => {
  vi.mocked(pickImportFile).mockReset();
  vi.mocked(importDroppedFile).mockReset();
});

describe("useFileImport", () => {
  it("選んだファイルのテキストを渡す。キャンセルでは渡さない", async () => {
    const onText = vi.fn();
    const user = userEvent.setup();
    vi.mocked(pickImportFile).mockResolvedValueOnce("取り込まれた文章");
    render(<Harness onText={onText} />);

    await user.click(screen.getByRole("button", { name: "pick" }));
    await waitFor(() => {
      expect(onText).toHaveBeenCalledWith("取り込まれた文章");
    });

    vi.mocked(pickImportFile).mockResolvedValueOnce(null);
    await user.click(screen.getByRole("button", { name: "pick" }));
    expect(onText).toHaveBeenCalledTimes(1);
  });

  it("取り込みの失敗を、種別のまま持つ", async () => {
    const user = userEvent.setup();
    vi.mocked(pickImportFile).mockRejectedValueOnce(
      new AppCommandError({ kind: "pdfNoText" }),
    );
    render(<Harness onText={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "pick" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("pdfNoText");
  });

  it("複数のファイルと大きすぎるファイルは、読まずに断る", async () => {
    render(<Harness onText={vi.fn()} />);

    dropFiles([new File(["a"], "a.txt"), new File(["b"], "b.txt")]);
    expect(await screen.findByRole("alert")).toHaveTextContent("fileTooMany");
    expect(importDroppedFile).not.toHaveBeenCalled();

    const big = new File(["x"], "big.txt");
    Object.defineProperty(big, "size", { value: PDF_MAX_BYTES + 1 });
    dropFiles([big]);
    expect(await screen.findByRole("alert")).toHaveTextContent("fileTooLarge");
    expect(importDroppedFile).not.toHaveBeenCalled();
  });

  it("無効なあいだは、ダイアログを開かない", async () => {
    const user = userEvent.setup();
    render(<Harness onText={vi.fn()} disabled />);

    await user.click(screen.getByRole("button", { name: "pick" }));

    expect(pickImportFile).not.toHaveBeenCalled();
  });
});
