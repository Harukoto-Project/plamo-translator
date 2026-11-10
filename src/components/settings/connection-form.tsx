import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type KeyChange, useSaveConnection } from "@/hooks/use-settings";
import { describeAppError } from "@/lib/app-error";
import { parseMaxTokens, type ResolvedSettings } from "@/lib/settings";
import { toAppError } from "@/services/ipc";
import type { AppError, KeyStatus } from "@/types/bindings";

interface ConnectionFormProps {
  initial: ResolvedSettings;
  keyStatus: KeyStatus;
  onSaved: () => void;
  onCancel: () => void;
}

/** 接続設定の入力フォーム。保存できたら `onSaved` を呼ぶ。 */
export function ConnectionForm({
  initial,
  keyStatus,
  onSaved,
  onCancel,
}: ConnectionFormProps) {
  const { t } = useTranslation();
  const ids = { url: useId(), model: useId(), key: useId(), tokens: useId() };
  const save = useSaveConnection();

  const [baseUrl, setBaseUrl] = useState(initial.connection.baseUrl);
  const [model, setModel] = useState(initial.connection.model);
  const [maxTokens, setMaxTokens] = useState(
    String(initial.generation.maxTokens),
  );
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const keySaved = keyStatus === "saved";

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedTokens = parseMaxTokens(maxTokens);
    if (parsedTokens === undefined) {
      setError({ kind: "invalidMaxTokens" });
      return;
    }
    setError(null);

    const keyChange: KeyChange =
      apiKey !== ""
        ? { type: "set", value: apiKey }
        : clearKey
          ? { type: "clear" }
          : { type: "keep" };

    save.mutate(
      {
        settings: {
          connection: { baseUrl, model },
          generation: { maxTokens: parsedTokens },
        },
        keyChange,
      },
      {
        onSuccess: onSaved,
        onError: (cause) => setError(toAppError(cause)),
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={ids.url}>{t("settings.baseUrl")}</FieldLabel>
          <Input
            id={ids.url}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <FieldDescription>{t("settings.baseUrlHint")}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor={ids.model}>{t("settings.model")}</FieldLabel>
          <Input
            id={ids.model}
            value={model}
            onChange={(event) => setModel(event.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <FieldDescription>{t("settings.modelHint")}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor={ids.key}>{t("settings.apiKey")}</FieldLabel>
          <Input
            id={ids.key}
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={keySaved ? t("settings.apiKeySaved") : undefined}
            autoComplete="off"
          />
          <FieldDescription>{t("settings.apiKeyHint")}</FieldDescription>
          {keySaved && apiKey === "" && (
            <div className="flex items-center gap-2">
              {clearKey && (
                <span className="text-xs text-muted-foreground">
                  {t("settings.apiKeyWillClear")}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClearKey((value) => !value)}
              >
                {clearKey
                  ? t("settings.apiKeyUndoClear")
                  : t("settings.apiKeyClear")}
              </Button>
            </div>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor={ids.tokens}>
            {t("settings.maxTokens")}
          </FieldLabel>
          <Input
            id={ids.tokens}
            inputMode="numeric"
            value={maxTokens}
            onChange={(event) => setMaxTokens(event.target.value)}
          />
          <FieldDescription>{t("settings.maxTokensHint")}</FieldDescription>
        </Field>
      </FieldGroup>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{describeAppError(error, t)}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("settings.cancel")}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t("settings.saving") : t("settings.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
