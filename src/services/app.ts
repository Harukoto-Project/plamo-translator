import { type AppInfo, commands } from "@/types/bindings";

/** アプリ名とバージョンを Rust から取得する。 */
export function getAppInfo(): Promise<AppInfo> {
  return commands.appInfo();
}
