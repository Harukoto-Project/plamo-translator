import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModels } from "@/hooks/use-models";
import { useProfiles, useSelectModel } from "@/hooks/use-profiles";
import { activeProfile, modelOptions } from "@/lib/profiles";

/**
 * 使用中の接続先のモデル。
 * 一覧が取れないときは、いまのモデル名だけを出して、変更は設定ダイアログの手入力に任せる。
 */
export function ModelSelect() {
  const { t } = useTranslation();
  const profiles = useProfiles();
  const select = useSelectModel();
  const active = profiles.data ? activeProfile(profiles.data) : undefined;
  const models = useModels(active?.id);
  if (!active) return null;

  const options = modelOptions(models.data ?? [], active.model);
  const label =
    active.model === "" ? t("settings.modelServerDefault") : active.model;
  if (models.isError || options.length === 0) {
    return (
      <p
        className="max-w-28 truncate text-xs text-muted-foreground sm:max-w-56"
        title={label}
      >
        {label}
      </p>
    );
  }

  return (
    <Select
      value={active.model === "" ? null : active.model}
      items={options.map((model) => ({ value: model, label: model }))}
      disabled={select.isPending}
      onValueChange={(next) => {
        if (next !== null && next !== active.model) {
          select.mutate({ profileId: active.id, model: next });
        }
      }}
    >
      <SelectTrigger
        aria-label={t("settings.model")}
        size="sm"
        className="max-w-28 sm:max-w-56"
      >
        <SelectValue placeholder={t("settings.modelServerDefault")} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((model) => (
          <SelectItem key={model} value={model}>
            {model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
