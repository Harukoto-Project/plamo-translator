import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useUpdateInstall } from "@/hooks/use-update-install";
import { checkForUpdate } from "@/services/updater";

const updateKey = ["app-update"] as const;

/**
 * アプリの更新。`enabled`のとき、起動後に1回だけ新しいバージョンを確認する。
 * 確認に失敗しても(オフライン、公開鍵がまだ無い、など)何も出さない。更新がなくても困らないため。
 */
export function useAppUpdate({ enabled }: { enabled: boolean }) {
  const check = useQuery({
    queryKey: updateKey,
    queryFn: checkForUpdate,
    enabled,
    retry: false,
    // 起動ごとに1回で十分。再フォーカスや再接続では確認し直さない
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [dismissed, setDismissed] = useState(false);

  const update = check.data ?? null;

  return {
    /** 新しいバージョン。なければ `null` */
    update,
    /** 「あとで」を選んだ(次の起動まで出さない) */
    dismissed,
    dismiss: () => {
      setDismissed(true);
      // インストールしない更新は、Rust側の資源を手放す
      if (!update) return;
      void update.close().catch(() => undefined);
    },
    ...useUpdateInstall(update),
  };
}
