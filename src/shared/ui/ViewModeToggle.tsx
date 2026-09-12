import { FiGrid, FiList } from "react-icons/fi";

import { cn } from "../lib/cn";
import { Button } from "./Button";
import type { CollectionViewMode } from "./useStoredViewMode";

interface ViewModeToggleProps {
  className?: string;
  onChange: (mode: CollectionViewMode) => void;
  value: CollectionViewMode;
}

export function ViewModeToggle({
  className,
  onChange,
  value,
}: ViewModeToggleProps): JSX.Element {
  return (
    <div
      aria-label="Режим отображения"
      className={cn(
        "app-border inline-flex items-center gap-1 border bg-[var(--color-surface)] p-1",
        className,
      )}
      role="group"
    >
      <Button
        aria-pressed={value === "table"}
        leftIcon={<FiList />}
        onClick={() => onChange("table")}
        size="sm"
        variant={value === "table" ? "primary" : "ghost"}
      >
        Таблица
      </Button>
      <Button
        aria-pressed={value === "cards"}
        leftIcon={<FiGrid />}
        onClick={() => onChange("cards")}
        size="sm"
        variant={value === "cards" ? "primary" : "ghost"}
      >
        Карточки
      </Button>
    </div>
  );
}
