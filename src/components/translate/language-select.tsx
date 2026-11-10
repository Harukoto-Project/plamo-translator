import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface LanguageOption<V extends string> {
  value: V;
  label: string;
}

interface LanguageSelectProps<V extends string> {
  /** 画面に出さない、読み上げ用のラベル */
  label: string;
  value: V;
  options: readonly LanguageOption<V>[];
  onChange: (value: V) => void;
  disabled?: boolean;
}

/** 選択肢から1つ選ぶ。言語の選択(原文は「自動」を含む)に使う。枠を出さず、ペインの見出しとして見せる。 */
export function LanguageSelect<V extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: LanguageSelectProps<V>) {
  return (
    <Select
      value={value}
      items={options}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger
        aria-label={label}
        className="min-w-0 border-transparent font-medium hover:bg-muted dark:bg-transparent dark:hover:bg-muted"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
