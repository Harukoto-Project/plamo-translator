import { useQuery } from "@tanstack/react-query";
import { listModels } from "@/services/models";

/** モデル一覧は、接続先が落ちていても翻訳の邪魔をしないよう、失敗してもやり直さない。 */
const STALE_MS = 5 * 60 * 1000;

/** 保存済みのプロファイルのモデル一覧。`profileId` が無いあいだは取らない。 */
export function useModels(profileId: string | undefined) {
  return useQuery({
    queryKey: ["models", profileId],
    queryFn: () => listModels(profileId ?? ""),
    enabled: profileId !== undefined && profileId !== "",
    staleTime: STALE_MS,
    retry: false,
  });
}
