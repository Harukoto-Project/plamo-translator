import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFileDrop } from "@/hooks/use-file-drop";

function Zone({
  onFiles,
  disabled = false,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const drop = useFileDrop(onFiles, disabled);
  return (
    <div data-testid="zone" {...drop.handlers}>
      {drop.dragging ? "dragging" : "idle"}
    </div>
  );
}

function dropFile(files: File[]) {
  fireEvent.drop(screen.getByTestId("zone"), {
    dataTransfer: {
      types: ["Files"],
      files,
      dropEffect: "none",
    },
  });
}

describe("useFileDrop", () => {
  it("ドロップされたファイルを渡す", () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} />);

    const file = new File(["hello"], "a.txt", { type: "text/plain" });
    dropFile([file]);

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0]?.[0]).toEqual([file]);
  });

  it("無効なあいだは、ドロップを渡さない", () => {
    const onFiles = vi.fn();
    render(<Zone onFiles={onFiles} disabled />);

    dropFile([new File(["hello"], "a.txt")]);

    expect(onFiles).not.toHaveBeenCalled();
  });
});
