import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModelField } from "@/components/settings/model-field";
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
import { type KeyChange, useSaveProfile } from "@/hooks/use-profiles";
import { useApiKeyStatus } from "@/hooks/use-settings";
import { describeAppError } from "@/lib/app-error";
import { parseChunkBudget, parseMaxTokens } from "@/lib/settings";
import { toAppError } from "@/services/ipc";
import type { AppError, ConnectionProfile } from "@/types/bindings";

interface ProfileFormProps {
  profile: ConnectionProfile;
  /** 使用中でなければ、切り替えボタンを出す */
  active: boolean;
  maxTokens: number;
  /** 全体設定。プロファイルごとには持たない */
  chunkBudget: number;
  onUse: () => void;
  using: boolean;
  onSaved: () => void;
  onCancel: () => void;
}

/** 選択中の接続先と、全体の生成設定(最大出力トークン数・分割の文字数)。 */
export function ProfileForm({
  profile,
  active,
  maxTokens: initialMaxTokens,
  chunkBudget: initialChunkBudget,
  onUse,
  using,
  onSaved,
  onCancel,
}: ProfileFormProps) {
  const { t } = useTranslation();
  const ids = {
    name: useId(),
    url: useId(),
    key: useId(),
    tokens: useId(),
    budget: useId(),
  };
  const save = useSaveProfile();
  const keyStatus = useApiKeyStatus(profile.id);

  const [name, setName] = useState(profile.name);
  const [baseUrl, setBaseUrl] = useState(profile.baseUrl);
  const [model, setModel] = useState(profile.model);
  const [maxTokens, setMaxTokens] = useState(String(initialMaxTokens));
  const [chunkBudget, setChunkBudget] = useState(String(initialChunkBudget));
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [unsavedKey, setUnsavedKey] = useState(false);

  const storedStatus = keyStatus.data;
  const keySaved = storedStatus === "saved" || storedStatus === "unsaved";

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedTokens = parseMaxTokens(maxTokens);
    if (parsedTokens === undefined) {
      setError({ kind: "invalidMaxTokens" });
      return;
    }
    const parsedBudget = parseChunkBudget(chunkBudget);
    if (parsedBudget === undefined) {
      setError({ kind: "invalidChunkBudget" });
      return;
    }
    setError(null);
    setUnsavedKey(false);

    const keyChange: KeyChange =
      apiKey !== ""
        ? { type: "set", value: apiKey }
        : clearKey
          ? { type: "clear" }
          : { type: "keep" };

    save.mutate(
      {
        profile: { id: profile.id, name, baseUrl, model },
        maxTokens: parsedTokens,
        chunkBudget: parsedBudget,
        keyChange,
      },
      {
        onSuccess: (status) => {
          if (status === "unsaved") {
            setUnsavedKey(true);
            setApiKey("");
            return;
          }
          onSaved();
        },
        onError: (cause) => setError(toAppError(cause)),
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
      {!active && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={using}
          onClick={onUse}
        >
          {t("settings.use")}
        </Button>
      )}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={ids.name}>{t("settings.name")}</FieldLabel>
          <Input
            id={ids.name}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={ids.url}>{t("settings.baseUrl")}</FieldLabel>
          <Input
            id={ids.url}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder={t("settings.baseUrlHint")}
          />
        </Field>
        <ModelField profileId={profile.id} value={model} onChange={setModel} />
        <Field>
          <FieldLabel htmlFor={ids.key}>{t("settings.apiKey")}</FieldLabel>
          <Input
            id={ids.key}
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              keySaved ? t("settings.apiKeySaved") : t("settings.apiKeyHint")
            }
            autoComplete="off"
          />
          {keySaved && apiKey === "" && (
            <div className="flex flex-wrap items-center gap-2">
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
          {(unsavedKey || storedStatus === "unsaved") && (
            <p role="status" className="text-xs text-muted-foreground">
              {t("settings.apiKeyUnsaved")}
            </p>
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
        <Field>
          <FieldLabel htmlFor={ids.budget}>
            {t("settings.chunkBudget")}
          </FieldLabel>
          <Input
            id={ids.budget}
            inputMode="numeric"
            value={chunkBudget}
            onChange={(event) => setChunkBudget(event.target.value)}
          />
          <FieldDescription>{t("settings.chunkBudgetHint")}</FieldDescription>
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
