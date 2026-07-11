import type { SelectOption } from "../../../shared/ui";
import { Input, Select, Textarea } from "../../../shared/ui";

interface TextFieldProps {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}

export function RelatedTextField({
  disabled = false,
  label,
  onChange,
  required = false,
  type = "text",
  value,
}: TextFieldProps): JSX.Element {
  return (
    <label className="block">
      <span className="app-text mb-2 block text-sm font-bold">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <Input
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

interface TextareaFieldProps {
  label: string;
  onChange: (value: string) => void;
  value: string;
}

export function RelatedTextareaField({
  label,
  onChange,
  value,
}: TextareaFieldProps): JSX.Element {
  return (
    <label className="block">
      <span className="app-text mb-2 block text-sm font-bold">{label}</span>
      <Textarea
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

interface SelectFieldProps {
  label: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  value: string;
}

export function RelatedSelectField({
  label,
  onValueChange,
  options,
  placeholder,
  value,
}: SelectFieldProps): JSX.Element {
  return (
    <label className="block">
      <span className="app-text mb-2 block text-sm font-bold">{label}</span>
      <Select
        onValueChange={onValueChange}
        options={options}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

interface ToggleFieldProps {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}

export function RelatedToggleField({
  checked,
  label,
  onCheckedChange,
}: ToggleFieldProps): JSX.Element {
  return (
    <button
      aria-checked={checked}
      className="app-surface-muted app-border flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition hover:bg-[var(--color-surface-hover)]"
      onClick={() => onCheckedChange(!checked)}
      role="switch"
      type="button"
    >
      <span className="app-text text-sm font-bold">{label}</span>
      <span
        className={[
          "relative h-7 w-12 rounded-full transition",
          checked ? "bg-[var(--accent)]" : "bg-[var(--color-border)]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
