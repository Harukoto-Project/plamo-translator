const MIB = 1024 * 1024;

/** バイト数を、画面に出す「10MB」のような文字列にする。 */
export function formatByteSize(bytes: number): string {
  const mib = bytes / MIB;
  if (Number.isInteger(mib)) return `${mib}MB`;
  return `${mib.toFixed(1)}MB`;
}
