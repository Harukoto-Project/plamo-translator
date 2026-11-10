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

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={label}
            onClick={onSwap}
            disabled={disabled}
            className={cn(
              "bg-sheet hover:bg-muted dark:bg-sheet dark:hover:bg-muted",
              className,
            )}
          >
            <ArrowLeftRightIcon aria-hidden="true" />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
