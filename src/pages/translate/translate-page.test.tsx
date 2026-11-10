import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TranslatePage } from "@/pages/translate/translate-page";

vi.mock("@/services/app", () => ({
  getAppInfo: vi
    .fn()
    .mockResolvedValue({ name: "plamo-translator", version: "9.9.9" }),
}));

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
});
