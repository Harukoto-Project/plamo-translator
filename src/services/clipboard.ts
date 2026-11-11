/** 文字列をクリップボードにコピーする。WebView の `navigator.clipboard` を使う。 */
export function copyText(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
