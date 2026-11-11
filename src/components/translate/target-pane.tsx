import { CheckIcon, CopyIcon, RotateCcwIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TranslateNotices } from "@/components/translate/translate-notices";
import { TranslateStatus } from "@/components/translate/translate-status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCopy } from "@/hooks/use-copy";
import type { TranslateState } from "@/lib/translate-state";

interface TargetPaneProps {
  state: TranslateState;
  /** 原文が空などで、再翻訳できないとき */
  retranslateDisabled: boolean;
  onRetranslate: () => void;
}

/**
 * 紙面の右(狭い幅では下)。訳文は明朝体で組み、入力欄の原文と見分けられるようにする。
 * エラー・警告、進み具合と出力速度、コピー・再翻訳の操作も出す。
 */
export function TargetPane({
  state,
  retranslateDisabled,
  onRetranslate,
}: TargetPaneProps) {
  const { t } = useTranslation();
  const id = useId();
  const { status: copyStatus, copy } = useCopy();
  const finished = state.status !== "idle" && state.status !== "running";

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-t @3xl:border-t-0 @3xl:border-l">
      <Label htmlFor={id} className="sr-only">
        {t("translate.targetLabel")}
      </Label>
      <Textarea
        id={id}
        readOnly
        value={state.text}
        placeholder={t("translate.targetPlaceholder")}
        className="min-h-28 flex-1 resize-none rounded-none border-0 bg-transparent px-4.5 py-3 font-serif text-[1.0625rem] leading-[1.8] field-sizing-fixed md:text-[1.0625rem] dark:bg-transparent @3xl:pl-9.5"
      />
      <TranslateNotices state={state} className="px-4.5 pb-2 @3xl:pl-9.5" />
      <div className="flex h-13 shrink-0 items-center justify-between gap-2 pr-3 pl-4.5 @3xl:pl-9.5">
        <TranslateStatus state={state} />
        <div className="flex shrink-0 items-center gap-1">
          {finished && (
            <Button
              variant="ghost"
              disabled={retranslateDisabled}
              onClick={onRetranslate}
            >
              <RotateCcwIcon aria-hidden="true" />
              {t("translate.retranslate")}
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={state.text === ""}
            onClick={() => void copy(state.text)}
          >
            {copyStatus === "copied" ? (
              <CheckIcon aria-hidden="true" />
            ) : (
              <CopyIcon aria-hidden="true" />
            )}
            {copyStatus === "copied"
              ? t("translate.copied")
              : copyStatus === "failed"
                ? t("translate.copyFailed")
                : t("translate.copy")}
          </Button>
        </div>
      </div>
    </section>
  );
}
