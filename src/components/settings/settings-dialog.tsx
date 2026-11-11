import { SettingsIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ProfileForm } from "@/components/settings/profile-form";
import { ProfileList } from "@/components/settings/profile-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProfiles, useSetActiveProfile } from "@/hooks/use-profiles";
import { useSettings } from "@/hooks/use-settings";
import { describeAppError } from "@/lib/app-error";
import { activeProfile } from "@/lib/profiles";
import { toAppError } from "@/services/ipc";
import type { ProfileBook } from "@/types/bindings";

/** 設定を開くボタンと、そのダイアログ。 */
export function SettingsDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost">
            <SettingsIcon aria-hidden="true" />
            {t("settings.open")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.description")}</DialogDescription>
        </DialogHeader>
        {open && <SettingsDialogBody onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialogBody({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const settings = useSettings();
  const profiles = useProfiles();
  const loadError = settings.error ?? profiles.error;

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {t("settings.loadFailed")}:{" "}
          {describeAppError(toAppError(loadError), t)}
        </AlertDescription>
      </Alert>
    );
  }

  if (!settings.data || !profiles.data) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("settings.loading")}
      </p>
    );
  }

  return (
    <SettingsEditor
      book={profiles.data}
      maxTokens={settings.data.generation.maxTokens}
      chunkBudget={settings.data.generation.chunkBudget}
      onClose={onClose}
    />
  );
}

function SettingsEditor({
  book,
  maxTokens,
  chunkBudget,
  onClose,
}: {
  book: ProfileBook;
  maxTokens: number;
  chunkBudget: number;
  onClose: () => void;
}) {
  const initial = activeProfile(book)?.id ?? book.profiles[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(initial);
  const setActive = useSetActiveProfile();
  const selected =
    book.profiles.find((profile) => profile.id === selectedId) ??
    book.profiles[0];

  if (!selected) {
    return null;
  }

  return (
    <div className="flex max-h-[min(36rem,70vh)] flex-col gap-4 overflow-y-auto sm:flex-row">
      <ProfileList
        book={book}
        selectedId={selected.id}
        onSelect={setSelectedId}
        onAdded={setSelectedId}
      />
      <ProfileForm
        key={selected.id}
        profile={selected}
        active={selected.id === book.activeId}
        maxTokens={maxTokens}
        chunkBudget={chunkBudget}
        using={setActive.isPending}
        onUse={() => setActive.mutate(selected.id)}
        onSaved={onClose}
        onCancel={onClose}
      />
    </div>
  );
}
