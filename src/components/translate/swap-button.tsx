import { ArrowLeftRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SwapButtonProps {
  onSwap: () => void;
  disabled?: boolean;
  className?: string;
}

/** 原文と訳文の言語・文章を入れ替える、アイコンだけのボタン。 */
export function SwapButton({ onSwap, disabled, className }: SwapButtonProps) {
  const { t } = useTranslation();
  const label = t("translate.swap");

  // 位置の指定(綴じ目に載せる translate など)は、ボタン自身ではなく外側に付ける
  return (
    <span className={cn("inline-flex", className)}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label={label}
              onClick={onSwap}
              disabled={disabled}
              className="bg-sheet hover:bg-muted dark:bg-sheet dark:hover:bg-muted"
            >
              <ArrowLeftRightIcon aria-hidden="true" />
            </Button>
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </span>
  );
}
