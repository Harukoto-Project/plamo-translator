import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddProfile, useRemoveProfile } from "@/hooks/use-profiles";
import { describeAppError } from "@/lib/app-error";
import { toAppError } from "@/services/ipc";
import type { AppError, ProfileBook, ProfilePreset } from "@/types/bindings";

const PRESETS: readonly ProfilePreset[] = [
  "vllm",
  "llamaCpp",
  "lmStudio",
  "ollama",
  "custom",
];

const PRESET_LABEL = {
  vllm: "settings.presets.vllm",
  llamaCpp: "settings.presets.llamaCpp",
  lmStudio: "settings.presets.lmStudio",
  ollama: "settings.presets.ollama",
  custom: "settings.presets.custom",
} as const;

interface ProfileListProps {
  book: ProfileBook;
  selectedId: string;
  onSelect: (id: string) => void;
  onAdded: (id: string) => void;
}

/** 接続先の一覧。追加・削除と、編集する1件の選択。 */
export function ProfileList({
  book,
  selectedId,
  onSelect,
  onAdded,
}: ProfileListProps) {
  const { t } = useTranslation();
  const add = useAddProfile();
  const remove = useRemoveProfile();
  const [preset, setPreset] = useState<ProfilePreset>("vllm");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const presetItems = PRESETS.map((value) => ({
    value,
    label: t(PRESET_LABEL[value]),
  }));
  const onlyOne = book.profiles.length === 1;

  function addProfile() {
    setError(null);
    add.mutate(preset, {
      onSuccess: (added) => {
        onAdded(added.id);
        setConfirming(false);
      },
      onError: (cause) => setError(toAppError(cause)),
    });
  }

  function removeProfile() {
    setError(null);
    remove.mutate(selectedId, {
      onSuccess: () => setConfirming(false),
      onError: (cause) => setError(toAppError(cause)),
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:w-56 sm:shrink-0">
      <p className="text-xs font-medium text-muted-foreground">
        {t("settings.profiles")}
      </p>
      <ul className="flex flex-col gap-1">
        {book.profiles.map((profile) => {
          const selected = profile.id === selectedId;
          const active = profile.id === book.activeId;
          return (
            <li key={profile.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onSelect(profile.id);
                  setConfirming(false);
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted aria-pressed:bg-muted"
              >
                <span className="flex w-full items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {profile.name}
                  </span>
                  {active && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("settings.active")}
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-xs text-muted-foreground">
                  {profile.baseUrl}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2">
        <Select
          value={preset}
          items={presetItems}
          onValueChange={(next) => {
            if (next !== null) setPreset(next);
          }}
        >
          <SelectTrigger aria-label={t("settings.preset")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presetItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={add.isPending}
          onClick={addProfile}
        >
          {t("settings.add")}
        </Button>
      </div>

      {onlyOne ? (
        <p className="text-xs text-muted-foreground">
          {t("settings.lastProfile")}
        </p>
      ) : confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={removeProfile}
          >
            {t("settings.deleteConfirm")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            {t("settings.deleteCancel")}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setConfirming(true)}
        >
          {t("settings.delete")}
        </Button>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{describeAppError(error, t)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
