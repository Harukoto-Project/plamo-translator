import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { ThemeProvider } from "@/components/common/theme-provider";
import "@/i18n";
import "@/styles/globals.css";

const queryClient = new QueryClient();

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root が見つかりません");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
