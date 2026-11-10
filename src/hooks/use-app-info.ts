import { useQuery } from "@tanstack/react-query";
import { getAppInfo } from "@/services/app";

/** アプリ名とバージョン。 */
export function useAppInfo() {
  return useQuery({
    queryKey: ["app-info"],
    queryFn: getAppInfo,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
