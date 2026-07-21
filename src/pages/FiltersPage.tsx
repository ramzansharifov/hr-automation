import type { IconType } from "react-icons";
import { FiCalendar, FiCreditCard, FiFilter } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";

import { ModuleFiltersPanel } from "../features/filters/components/ModuleFiltersPanel";
import {
  OperationalRegistryPanel,
  type OperationalRegistry,
} from "../features/filters/components/OperationalRegistryPanel";
import { PageHeader } from "../shared/ui";

type FiltersSection = "general" | OperationalRegistry;

const sections: Array<{
  id: FiltersSection;
  label: string;
  icon: IconType;
}> = [
  { id: "general", label: "Общие фильтры", icon: FiFilter },
  { id: "vacations", label: "Отпуска", icon: FiCalendar },
  { id: "payroll", label: "Начисления", icon: FiCreditCard },
];

export function FiltersPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = parseSection(searchParams.get("module"));
  const employeeId = parseEmployeeId(searchParams.get("employee"));

  function changeSection(nextSection: FiltersSection): void {
    setSearchParams(nextSection === "general" ? {} : { module: nextSection });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Фильтры и реестры" />

      <nav
        aria-label="Разделы фильтров"
        className="app-surface app-border flex max-w-full gap-2 overflow-x-auto rounded-[24px] border p-2"
      >
        {sections.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === section;

          return (
            <button
              className={[
                "flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-black transition",
                isActive
                  ? "border-[var(--accent-border)] bg-[var(--accent)] text-white shadow-lg"
                  : "app-button-secondary",
              ].join(" ")}
              key={item.id}
              onClick={() => changeSection(item.id)}
              type="button"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {section === "general" ? (
        <ModuleFiltersPanel />
      ) : (
        <OperationalRegistryPanel
          employeeId={employeeId}
          key={`${section}-${employeeId}`}
          registry={section}
        />
      )}
    </div>
  );
}

function parseSection(value: string | null): FiltersSection {
  return value === "vacations" || value === "payroll" ? value : "general";
}

function parseEmployeeId(value: string | null): string {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? String(id) : "";
}
