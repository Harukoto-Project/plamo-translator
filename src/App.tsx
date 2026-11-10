import { pages } from "@/pages/registry";

/** 現状は画面が1つだけ。ナビゲーションは②以降で追加する。 */
export default function App() {
  const Page = pages.translate;
  return <Page />;
}
