import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { languages } from "@/lib/languages";
import type { Lang } from "@/types/bindings";

interface LanguageSelectProps {
  /** 画面に出さない、読み上げ用のラベル */
  label: string;
  value: Lang;
  onChange: (lang: Lang) => void;
  disabled?: boolean;
}

/** 言語を1つ選ぶ。 */
export function LanguageSelect({
  label,
  value,
  onChange,
  disabled,
}: LanguageSelectProps) {
  const { t } = useTranslation();
  const items = languages.map((lang) => ({
    value: lang,
    label: t(`languages.${lang}`),
  }));

  return (
    <Select
      value={value}
      items={items}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger aria-label={label} className="w-full sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
