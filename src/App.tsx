import { UpdateDialog } from "@/components/update/update-dialog";
import { pages } from "@/pages/registry";

/** 現状は画面が1つだけ。ナビゲーションは②以降で追加する。 */
export default function App() {
  const Page = pages.translate;
  return (
    <>
      <Page />
      {/* 開発中(`pnpm tauri dev`)は更新を確認しない。署名された配布物ではないため */}
      <UpdateDialog enabled={!import.meta.env.DEV} />
    </>
  );
}
