import { useEffect, useState } from "react";
import { FiGrid, FiList } from "react-icons/fi";

export type CollectionViewMode = "table" | "cards";

const STORAGE_PREFIX = "hr-collection-view-mode:";

export function useStoredViewMode(
  storageKey: string,
  defaultMode: CollectionViewMode = "table",
): readonly [CollectionViewMode, (mode: CollectionViewMode) => void] {
  const [mode, setMode] = useState<CollectionViewMode>(() =>
    readStoredMode(storageKey, defaultMode),
  );

  useEffect(() => {
    setMode(readStoredMode(storageKey, defaultMode));
  }, [defaultMode, storageKey]);

  function updateMode(nextMode: CollectionViewMode): void {
    setMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, nextMode);
    }
  }

  return [mode, updateMode] as const;
}

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
      className={`app-surface app-border inline-flex items-center gap-1 rounded-2xl border p-1 shadow-none ${className}`}
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
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]",
    isActive
      ? "border-[var(--accent-border)] bg-[var(--accent)] text-white shadow-sm"
      : "border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
  ].join(" ");
}

function readStoredMode(
  storageKey: string,
  fallback: CollectionViewMode,
): CollectionViewMode {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
  return stored === "table" || stored === "cards" ? stored : fallback;
}
