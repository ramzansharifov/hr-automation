import { ModuleFiltersPanel } from "../features/filters/components/ModuleFiltersPanel";
import { PageHeader } from "../shared/ui";

export function FiltersPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title="Фильтры" />
      <ModuleFiltersPanel />
    </div>
  );
}
