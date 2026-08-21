import { FiFilter } from "react-icons/fi";

import { UnifiedFiltersWorkspace } from "../features/filters/components/UnifiedFiltersWorkspace";
import { PageHeader } from "../shared/ui";

export function FiltersPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        description="Единый центр фильтрации данных по сотрудникам, структуре, отпускам, вакансиям и кандидатам."
        icon={<FiFilter />}
        title="Фильтры"
      />
      <UnifiedFiltersWorkspace />
    </div>
  );
}
