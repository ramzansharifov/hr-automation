import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  FiBriefcase,
  FiCalendar,
  FiClipboard,
  FiFilter,
  FiLayers,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { appText, useAppText } from "../../../shared/i18n";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { HrFilterCondition, HrRecord } from "../../../shared/types/hr";
import {
  ActionButton,
  EmptyState,
  Input,
  LoadingState,
  Select,
  type SelectOption,
} from "../../../shared/ui";
import { useEmployeeFormOptions } from "../../employees/hooks/useEmployeeFormOptions";
import { HrEntityTable } from "../../hr-table/HrEntityTable";
import {
  buildEmployeeFilters,
  clearStoredEmployeeFilterValues,
  emptyEmployeeFilters,
  getStoredEmployeeFilterValues,
  setStoredEmployeeFilterValues,
  type EmployeeFilterValues,
} from "../employeeFiltersStore";
import {
  buildVacationHrFilters,
  clearStoredCandidateFilterValues,
  clearStoredEnterpriseFilterValues,
  clearStoredVacancyFilterValues,
  clearStoredVacationFilterValues,
  emptyCandidateFilters,
  emptyEnterpriseFilters,
  emptyVacancyFilters,
  emptyVacationFilters,
  filterCandidates,
  filterVacancies,
  getStoredCandidateFilterValues,
  getStoredEnterpriseFilterValues,
  getStoredVacancyFilterValues,
  getStoredVacationFilterValues,
  setStoredCandidateFilterValues,
  setStoredEnterpriseFilterValues,
  setStoredVacancyFilterValues,
  setStoredVacationFilterValues,
  type CandidateFilterValues,
  type EnterpriseFilterValues,
  type VacancyFilterValues,
  type VacationFilterValues,
} from "../moduleFiltersStore";

type FilterModule = "employees" | "enterprises" | "vacations" | "vacancies" | "candidates";

export function UnifiedFiltersWorkspace(): JSX.Element {
  const text = useAppText();
  const moduleTabs: Array<{
    id: FilterModule;
    label: string;
    icon: typeof FiUsers;
  }> = [
    { id: "employees", label: text("Сотрудники", "Employees"), icon: FiUsers },
    { id: "enterprises", label: text("Предприятия", "Enterprises"), icon: FiLayers },
    { id: "vacations", label: text("Отпуска", "Vacations"), icon: FiCalendar },
    { id: "vacancies", label: text("Вакансии", "Vacancies"), icon: FiBriefcase },
    { id: "candidates", label: text("Кандидаты", "Candidates"), icon: FiClipboard },
  ];
  const vacancyStatusOptions: SelectOption[] = [
    { value: "open", label: text("Открыта", "Open") },
    { value: "draft", label: text("Черновик", "Draft") },
    { value: "paused", label: text("Приостановлена", "Paused") },
    { value: "closed", label: text("Закрыта", "Closed") },
  ];
  const employmentTypeOptions: SelectOption[] = [
    { value: "full_time", label: text("Полная занятость", "Full-time") },
    { value: "part_time", label: text("Частичная занятость", "Part-time") },
    { value: "temporary", label: text("Временная работа", "Temporary") },
    { value: "internship", label: text("Стажировка", "Internship") },
  ];
  const candidateStatusOptions: SelectOption[] = [
    { value: "new", label: text("Новый", "New") },
    { value: "screening", label: text("Первичный отбор", "Screening") },
    { value: "interview", label: text("Собеседование", "Interview") },
    { value: "offer", label: text("Оффер", "Offer") },
    { value: "hired", label: text("Принят", "Hired") },
    { value: "rejected", label: text("Отклонён", "Rejected") },
  ];
  const vacationStatusOptions: SelectOption[] = [
    { value: "planned", label: text("Запланирован", "Planned") },
    { value: "approved", label: text("Согласован", "Approved") },
    { value: "rejected", label: text("Отклонён", "Rejected") },
    { value: "completed", label: text("Завершён", "Completed") },
  ];
  const paidOptions: SelectOption[] = [
    { value: "1", label: text("Оплачиваемый", "Paid") },
    { value: "0", label: text("Неоплачиваемый", "Unpaid") },
  ];
  const [activeModule, setActiveModule] = useState<FilterModule>("employees");
  const [employeeFilters, setEmployeeFilters] = useState<EmployeeFilterValues>(getStoredEmployeeFilterValues);
  const [enterpriseFilters, setEnterpriseFilters] = useState<EnterpriseFilterValues>(getStoredEnterpriseFilterValues);
  const [vacationFilters, setVacationFilters] = useState<VacationFilterValues>(getStoredVacationFilterValues);
  const [vacancyFilters, setVacancyFilters] = useState<VacancyFilterValues>(getStoredVacancyFilterValues);
  const [candidateFilters, setCandidateFilters] = useState<CandidateFilterValues>(getStoredCandidateFilterValues);
  const [appliedRevision, setAppliedRevision] = useState(0);
  const [vacancies, setVacancies] = useState<HrRecord[]>([]);
  const [candidates, setCandidates] = useState<HrRecord[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
  const [vacancyOptions, setVacancyOptions] = useState<SelectOption[]>([]);
  const [isRecruitmentLoading, setIsRecruitmentLoading] = useState(false);
  const { departments, genderOptions, isRelationsLoading, positions, statusOptions } = useEmployeeFormOptions();

  useEffect(() => {
    let active = true;
    Promise.all([loadAllEmployees(), hrApiClient.listVacancies({})])
      .then(([employees, vacancyRows]) => {
        if (!active) return;
        setEmployeeOptions(employees);
        setVacancies(vacancyRows);
        setVacancyOptions(
          vacancyRows.map((row) => ({
            value: String(row.id),
            label: [row.position_name, row.department_name, row.enterprise_name].filter(Boolean).join(" · "),
          })),
        );
      })
      .catch(() => active && toast.error(text("Не удалось загрузить данные для фильтров", "Failed to load filter data")));
    return () => {
      active = false;
    };
  }, [text]);

  useEffect(() => {
    if (activeModule !== "candidates") return;
    setIsRecruitmentLoading(true);
    hrApiClient
      .listCandidates({})
      .then(setCandidates)
      .catch(() => toast.error(text("Не удалось загрузить кандидатов", "Failed to load candidates")))
      .finally(() => setIsRecruitmentLoading(false));
  }, [activeModule, text]);

  const activeCount = useMemo(() => {
    const values = getActiveValues(activeModule, employeeFilters, enterpriseFilters, vacationFilters, vacancyFilters, candidateFilters);
    return Object.values(values).filter((value) => value.trim() !== "").length;
  }, [activeModule, candidateFilters, employeeFilters, enterpriseFilters, vacationFilters, vacancyFilters]);

  function applyFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (activeModule === "employees") setStoredEmployeeFilterValues(employeeFilters);
    else if (activeModule === "enterprises") setStoredEnterpriseFilterValues(enterpriseFilters);
    else if (activeModule === "vacations") setStoredVacationFilterValues(vacationFilters);
    else if (activeModule === "vacancies") setStoredVacancyFilterValues(vacancyFilters);
    else setStoredCandidateFilterValues(candidateFilters);
    setAppliedRevision((value) => value + 1);
  }

  function clearFilters(): void {
    if (activeModule === "employees") {
      setEmployeeFilters(emptyEmployeeFilters);
      clearStoredEmployeeFilterValues();
    } else if (activeModule === "enterprises") {
      setEnterpriseFilters(emptyEnterpriseFilters);
      clearStoredEnterpriseFilterValues();
    } else if (activeModule === "vacations") {
      setVacationFilters(emptyVacationFilters);
      clearStoredVacationFilterValues();
    } else if (activeModule === "vacancies") {
      setVacancyFilters(emptyVacancyFilters);
      clearStoredVacancyFilterValues();
    } else {
      setCandidateFilters(emptyCandidateFilters);
      clearStoredCandidateFilterValues();
    }
    setAppliedRevision((value) => value + 1);
  }

  const activeTab = moduleTabs.find((tab) => tab.id === activeModule) ?? moduleTabs[0];

  return (
    <div className="space-y-6">
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft border-b p-3 sm:p-4">
          <div className="flex max-w-full gap-2 overflow-x-auto">
            {moduleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeModule;
              return (
                <button
                  className={[
                    "flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-black transition",
                    isActive ? "border-[var(--accent-border)] bg-[var(--accent)] text-white shadow-lg" : "app-button-secondary",
                  ].join(" ")}
                  key={tab.id}
                  onClick={() => setActiveModule(tab.id)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="app-border-soft flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <h2 className="app-text text-lg font-black">{activeTab.label}</h2>
          <div className="app-accent-soft flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-black">
            <FiFilter className="h-4 w-4" />
            {text("Активных фильтров:", "Active filters:")} {activeCount}
          </div>
        </div>

        <form className="p-5 sm:p-7" onSubmit={applyFilters}>
          {activeModule === "employees" && (
            <FilterGrid>
              <FilterInput label={text("Фамилия", "Last name")} value={employeeFilters.last_name} onChange={(value) => setEmployeeFilters((v) => ({ ...v, last_name: value }))} />
              <FilterInput label={text("Имя", "First name")} value={employeeFilters.first_name} onChange={(value) => setEmployeeFilters((v) => ({ ...v, first_name: value }))} />
              <FilterInput label={text("Отчество", "Middle name")} value={employeeFilters.middle_name} onChange={(value) => setEmployeeFilters((v) => ({ ...v, middle_name: value }))} />
              <FilterInput label={text("Телефон", "Phone")} value={employeeFilters.phone} onChange={(value) => setEmployeeFilters((v) => ({ ...v, phone: value }))} />
              <FilterInput label="Email" value={employeeFilters.email} onChange={(value) => setEmployeeFilters((v) => ({ ...v, email: value }))} />
              <FilterSelect label={text("Отдел", "Department")} disabled={isRelationsLoading} options={departments} value={employeeFilters.department_id} onValueChange={(value) => setEmployeeFilters((v) => ({ ...v, department_id: value }))} />
              <FilterSelect label={text("Должность", "Position")} disabled={isRelationsLoading} options={positions} value={employeeFilters.position_id} onValueChange={(value) => setEmployeeFilters((v) => ({ ...v, position_id: value }))} />
              <FilterSelect label={text("Статус", "Status")} options={statusOptions} value={employeeFilters.status} onValueChange={(value) => setEmployeeFilters((v) => ({ ...v, status: value }))} />
              <FilterSelect label={text("Пол", "Gender")} options={genderOptions} value={employeeFilters.gender} onValueChange={(value) => setEmployeeFilters((v) => ({ ...v, gender: value }))} />
            </FilterGrid>
          )}

          {activeModule === "enterprises" && (
            <FilterGrid>
              <FilterInput label={text("Название", "Name")} value={enterpriseFilters.name} onChange={(value) => setEnterpriseFilters((v) => ({ ...v, name: value }))} />
              <FilterInput label={text("Юридическое наименование", "Legal name")} value={enterpriseFilters.legal_name} onChange={(value) => setEnterpriseFilters((v) => ({ ...v, legal_name: value }))} />
              <FilterInput label={text("Телефон", "Phone")} value={enterpriseFilters.phone} onChange={(value) => setEnterpriseFilters((v) => ({ ...v, phone: value }))} />
              <FilterInput label="Email" value={enterpriseFilters.email} onChange={(value) => setEnterpriseFilters((v) => ({ ...v, email: value }))} />
            </FilterGrid>
          )}

          {activeModule === "vacations" && (
            <FilterGrid>
              <FilterSelect label={text("Сотрудник", "Employee")} options={employeeOptions} value={vacationFilters.employee_id} onValueChange={(value) => setVacationFilters((v) => ({ ...v, employee_id: value }))} />
              <FilterInput label={text("Тип отпуска", "Vacation type")} value={vacationFilters.vacation_type} onChange={(value) => setVacationFilters((v) => ({ ...v, vacation_type: value }))} />
              <FilterSelect label={text("Статус", "Status")} options={vacationStatusOptions} value={vacationFilters.status} onValueChange={(value) => setVacationFilters((v) => ({ ...v, status: value }))} />
              <FilterSelect label={text("Оплачиваемость", "Payment")} options={paidOptions} value={vacationFilters.is_paid} onValueChange={(value) => setVacationFilters((v) => ({ ...v, is_paid: value }))} />
              <FilterInput label={text("Дата начала", "Start date")} type="date" value={vacationFilters.starts_at} onChange={(value) => setVacationFilters((v) => ({ ...v, starts_at: value }))} />
              <FilterInput label={text("Дата окончания", "End date")} type="date" value={vacationFilters.ends_at} onChange={(value) => setVacationFilters((v) => ({ ...v, ends_at: value }))} />
            </FilterGrid>
          )}

          {activeModule === "vacancies" && (
            <FilterGrid>
              <FilterSelect label={text("Статус", "Status")} options={vacancyStatusOptions} value={vacancyFilters.status} onValueChange={(value) => setVacancyFilters((v) => ({ ...v, status: value }))} />
              <FilterSelect label={text("Формат занятости", "Employment type")} options={employmentTypeOptions} value={vacancyFilters.employment_type} onValueChange={(value) => setVacancyFilters((v) => ({ ...v, employment_type: value }))} />
              <FilterInput label={text("Предприятие", "Enterprise")} value={vacancyFilters.enterprise_name} onChange={(value) => setVacancyFilters((v) => ({ ...v, enterprise_name: value }))} />
              <FilterInput label={text("Отдел", "Department")} value={vacancyFilters.department_name} onChange={(value) => setVacancyFilters((v) => ({ ...v, department_name: value }))} />
              <FilterInput label={text("Должность", "Position")} value={vacancyFilters.position_name} onChange={(value) => setVacancyFilters((v) => ({ ...v, position_name: value }))} />
            </FilterGrid>
          )}

          {activeModule === "candidates" && (
            <FilterGrid>
              <FilterSelect label={text("Этап подбора", "Recruitment stage")} options={candidateStatusOptions} value={candidateFilters.status} onValueChange={(value) => setCandidateFilters((v) => ({ ...v, status: value }))} />
              <FilterSelect label={text("Вакансия", "Vacancy")} options={vacancyOptions} value={candidateFilters.vacancy_id} onValueChange={(value) => setCandidateFilters((v) => ({ ...v, vacancy_id: value }))} />
              <FilterInput label={text("Источник", "Source")} value={candidateFilters.source} onChange={(value) => setCandidateFilters((v) => ({ ...v, source: value }))} />
              <FilterInput label={text("Минимальное соответствие, %", "Minimum match, %")} type="number" value={candidateFilters.min_match} onChange={(value) => setCandidateFilters((v) => ({ ...v, min_match: value }))} />
            </FilterGrid>
          )}

          <div className="app-border-soft mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
            <ActionButton action="reset" onClick={clearFilters} type="button">{text("Очистить", "Clear")}</ActionButton>
            <ActionButton action="search" type="submit">{text("Применить фильтры", "Apply filters")}</ActionButton>
          </div>
        </form>
      </section>

      <section className="app-surface app-border overflow-hidden rounded-[24px] border">
        <ResultsPanel
          activeModule={activeModule}
          text={text}
          appliedRevision={appliedRevision}
          candidateFilters={candidateFilters}
          candidates={candidates}
          employeeFilters={employeeFilters}
          enterpriseFilters={enterpriseFilters}
          isRecruitmentLoading={isRecruitmentLoading}
          vacationFilters={vacationFilters}
          vacancies={vacancies}
          vacancyFilters={vacancyFilters}
        />
      </section>
    </div>
  );
}

function ResultsPanel({
  activeModule,
  appliedRevision,
  candidateFilters,
  candidates,
  employeeFilters,
  enterpriseFilters,
  isRecruitmentLoading,
  vacationFilters,
  vacancies,
  vacancyFilters,
  text,
}: {
  activeModule: FilterModule;
  text: (ru: string, en: string) => string;
  appliedRevision: number;
  candidateFilters: CandidateFilterValues;
  candidates: HrRecord[];
  employeeFilters: EmployeeFilterValues;
  enterpriseFilters: EnterpriseFilterValues;
  isRecruitmentLoading: boolean;
  vacationFilters: VacationFilterValues;
  vacancies: HrRecord[];
  vacancyFilters: VacancyFilterValues;
}): JSX.Element {
  if (activeModule === "employees") {
    return <HrEntityTable key={`employees-${appliedRevision}`} entity="employees" externalFilters={buildEmployeeFilters(employeeFilters)} />;
  }
  if (activeModule === "enterprises") {
    return <HrEntityTable key={`enterprises-${appliedRevision}`} entity="enterprises" externalFilters={buildTextFilters(enterpriseFilters)} />;
  }
  if (activeModule === "vacations") {
    return <HrEntityTable key={`vacations-${appliedRevision}`} entity="vacations" externalFilters={buildVacationHrFilters(vacationFilters)} />;
  }
  if (isRecruitmentLoading) {
    return <div className="p-12"><LoadingState label={text("Загрузка результатов...", "Loading results...")} /></div>;
  }
  const rows = activeModule === "vacancies" ? filterVacancies(vacancies, vacancyFilters) : filterCandidates(candidates, candidateFilters);
  if (rows.length === 0) {
    return <div className="py-14"><EmptyState title={text("Ничего не найдено", "Nothing found")} description={text("Измените условия фильтрации и повторите поиск.", "Change the filter conditions and try again.")} /></div>;
  }
  return <SimpleResultsTable module={activeModule} rows={rows} text={text} />;
}

function SimpleResultsTable({
  module,
  rows,
  text,
}: {
  module: "vacancies" | "candidates";
  rows: HrRecord[];
  text: (ru: string, en: string) => string;
}): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="app-surface-muted app-muted text-xs">
            {module === "vacancies" ? (
              <>
                <TableHead>{text("Должность", "Position")}</TableHead><TableHead>{text("Предприятие", "Enterprise")}</TableHead><TableHead>{text("Отдел", "Department")}</TableHead><TableHead>{text("Статус", "Status")}</TableHead><TableHead>{text("Занятость", "Employment")}</TableHead><TableHead>{text("Кандидатов", "Candidates")}</TableHead>
              </>
            ) : (
              <>
                <TableHead>{text("Кандидат", "Candidate")}</TableHead><TableHead>{text("Вакансия", "Vacancy")}</TableHead><TableHead>{text("Этап", "Stage")}</TableHead><TableHead>{text("Источник", "Source")}</TableHead><TableHead>{text("Соответствие", "Match")}</TableHead><TableHead>{text("Контакты", "Contacts")}</TableHead>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="app-hover-muted transition" key={String(row.id)}>
              {module === "vacancies" ? (
                <>
                  <TableCell strong>{String(row.position_name ?? "—")}</TableCell>
                  <TableCell>{String(row.enterprise_name ?? "—")}</TableCell>
                  <TableCell>{String(row.department_name ?? "—")}</TableCell>
                  <TableCell>{String(row.status ?? "—")}</TableCell>
                  <TableCell>{String(row.employment_type ?? "—")}</TableCell>
                  <TableCell>{String(row.candidates_count ?? 0)}</TableCell>
                </>
              ) : (
                <>
                  <TableCell strong>{[row.last_name, row.first_name, row.middle_name].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell>{String(row.vacancy_position_name ?? row.position_name ?? "—")}</TableCell>
                  <TableCell>{String(row.status ?? "—")}</TableCell>
                  <TableCell>{String(row.source ?? "—")}</TableCell>
                  <TableCell>{`${String(row.match_percentage ?? 0)}%`}</TableCell>
                  <TableCell>{[row.phone, row.email].filter(Boolean).join(" · ") || "—"}</TableCell>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="app-border-soft app-muted border-t px-5 py-4 text-sm">{text("Найдено:", "Found:")} <span className="app-text font-black">{rows.length}</span></div>
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }): JSX.Element {
  return <th className="app-border-soft border-b px-5 py-4 font-black">{children}</th>;
}
function TableCell({ children, strong = false }: { children: ReactNode; strong?: boolean }): JSX.Element {
  return <td className={`app-border-soft border-b px-5 py-4 ${strong ? "app-text font-black" : "app-text-soft"}`}>{children}</td>;
}
function FilterGrid({ children }: { children: ReactNode }): JSX.Element {
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
function FilterInput({ label, onChange, value, type = "text" }: { label: string; onChange: (value: string) => void; value: string; type?: string }): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-bold">{label}</span>
      <Input aria-label={label} onChange={(event) => onChange(event.target.value)} placeholder={type === "date" ? undefined : label} type={type} value={value} />
    </label>
  );
}
function FilterSelect({ disabled = false, label, onValueChange, options, value }: { disabled?: boolean; label: string; onValueChange: (value: string) => void; options: SelectOption[]; value: string }): JSX.Element {
  const text = useAppText();
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-bold">{label}</span>
      <Select allowEmpty ariaLabel={label} disabled={disabled} emptyOptionLabel={text("Все", "All")} onValueChange={onValueChange} options={options} placeholder={text("Все", "All")} value={value} />
    </label>
  );
}
function buildTextFilters(values: EnterpriseFilterValues): Record<string, HrFilterCondition> | undefined {
  const filters: Record<string, HrFilterCondition> = {};
  Object.entries(values).forEach(([key, rawValue]) => {
    const value = rawValue.trim();
    if (value) filters[key] = { operator: "contains", value };
  });
  return Object.keys(filters).length > 0 ? filters : undefined;
}
function getActiveValues(
  module: FilterModule,
  employees: EmployeeFilterValues,
  enterprises: EnterpriseFilterValues,
  vacations: VacationFilterValues,
  vacancies: VacancyFilterValues,
  candidates: CandidateFilterValues,
): Record<string, string> {
  if (module === "employees") return employees;
  if (module === "enterprises") return enterprises;
  if (module === "vacations") return vacations;
  if (module === "vacancies") return vacancies;
  return candidates;
}
async function loadAllEmployees(): Promise<SelectOption[]> {
  const rows: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await hrApiClient.list({ entity: "employees", page, pageSize: 100, orderBy: "last_name", orderDirection: "asc" });
    rows.push(...result.items);
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);
  return rows.map((row) => ({
    value: String(row.id ?? ""),
    label: [row.last_name, row.first_name, row.middle_name].map((part) => String(part ?? "").trim()).filter(Boolean).join(" ") || appText(`Сотрудник #${String(row.id ?? "")}`, `Employee #${String(row.id ?? "")}`),
  }));
}