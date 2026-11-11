interface Titled {
  title: string;
}

/** 大文字小文字・全角半角の違いを無視して比べるための形にする。 */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

/**
 * タイトルで履歴を絞り込む。空白で区切った語をすべて含むものだけを残す(AND)。
 * 語が無ければ、渡されたものをそのまま返す。並びは変えない。
 */
export function filterByTitle<T extends Titled>(
  items: readonly T[],
  query: string,
): T[] {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...items];
  return items.filter((item) => {
    const title = normalizeForSearch(item.title);
    return terms.every((term) => title.includes(term));
  });
}
