import { FiFilter } from "react-icons/fi";

import { UnifiedFiltersWorkspace } from "../features/filters/components/UnifiedFiltersWorkspace";
import { useAppText } from "../shared/i18n";
import { PageHeader } from "../shared/ui";

export function FiltersPage(): JSX.Element {
  const text = useAppText();
  return (
    <div className="space-y-6">
      <PageHeader
        description={text("Единый центр фильтрации данных по сотрудникам, структуре, отпускам, вакансиям и кандидатам.", "Unified filtering center for employees, organization structure, vacations, vacancies, and candidates.")}
        icon={<FiFilter />}
        title={text("Фильтры", "Filters")}
      />
      <UnifiedFiltersWorkspace />
    </div>
  );
}
