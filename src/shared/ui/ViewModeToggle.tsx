import { FiGrid, FiList } from "react-icons/fi";
import type { CollectionViewMode } from "./useStoredViewMode";

export function ViewModeToggle({
  className = "",
  onChange,
  value,
}: {
  className?: string;
  onChange: (mode: CollectionViewMode) => void;
  value: CollectionViewMode;
}): JSX.Element {
  return (
    <div
      aria-label="Режим отображения"
      className={`app-border inline-flex items-center gap-1 rounded-xl border bg-[var(--color-surface)] p-1 ${className}`}
      role="group"
    >
      <button
        aria-pressed={value === "table"}
        className={getButtonClass(value === "table")}
        onClick={() => onChange("table")}
        type="button"
      >
        <FiList className="h-4 w-4" />
        Таблица
      </button>
      <button
        aria-pressed={value === "cards"}
        className={getButtonClass(value === "cards")}
        onClick={() => onChange("cards")}
        type="button"
      >
        <FiGrid className="h-4 w-4" />
        Карточки
      </button>
    </div>
  );
}

function getButtonClass(isActive: boolean): string {
  return [
    "inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3.5 text-sm font-bold transition",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]",
    isActive
      ? "border-[var(--accent-border)] bg-[var(--accent)] text-white"
      : "border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
  ].join(" ");
}
