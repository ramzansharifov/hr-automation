import { FiFilter } from "react-icons/fi";

import { UnifiedFiltersWorkspace } from "../features/filters/components/UnifiedFiltersWorkspace";
import { PageHeader } from "../shared/ui";

export function FiltersPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader icon={<FiFilter />} title="Фильтры" />
      <UnifiedFiltersWorkspace />
    </div>
  );
}
