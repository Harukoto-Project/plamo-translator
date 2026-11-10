import path from "node:path";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },

  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },

  // Tauri の `tauri dev` / `tauri build` 向けの設定
  //
  // 1. Rust のエラーを Vite が隠さないようにする
  clearScreen: false,
  // 2. Tauri は固定ポートを前提にする。使用中なら失敗させる
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. src-tauri は監視しない
      ignored: ["**/src-tauri/**"],
    },
  },
}));
