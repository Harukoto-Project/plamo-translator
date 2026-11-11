import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModels } from "@/hooks/use-models";
import { describeAppError } from "@/lib/app-error";
import { modelOptions } from "@/lib/profiles";
import { toAppError } from "@/services/ipc";

interface ModelFieldProps {
  profileId: string;
  value: string;
  onChange: (value: string) => void;
}

/** モデル名の入力。一覧が取れればそこから選べ、取れなければ手入力のまま。 */
export function ModelField({ profileId, value, onChange }: ModelFieldProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const models = useModels(profileId);
  const options = modelOptions(models.data ?? [], value);
  const pickable = models.isSuccess && options.length > 0;

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>{t("settings.model")}</FieldLabel>
      <Input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoComplete="off"
        placeholder={t("settings.modelHint")}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={models.isFetching}
          onClick={() => void models.refetch()}
        >
          {models.isFetching
            ? t("settings.modelFetching")
            : t("settings.modelFetch")}
        </Button>
        {pickable && (
          <Select
            value={value === "" ? null : value}
            items={options.map((model) => ({ value: model, label: model }))}
            onValueChange={(next) => {
              if (next !== null) onChange(next);
            }}
          >
            <SelectTrigger
              aria-label={t("settings.modelPick")}
              className="max-w-full"
            >
              <SelectValue placeholder={t("settings.modelPick")} />
            </SelectTrigger>
            <SelectContent>
              {options.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <FieldDescription>{t("settings.modelSavedHint")}</FieldDescription>
      {models.isError && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("settings.modelUnavailable")}
          {describeAppError(toAppError(models.error), t)}
        </p>
      )}
      {models.isSuccess && models.data.length === 0 && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("settings.modelEmpty")}
        </p>
      )}
    </Field>
  );
}
