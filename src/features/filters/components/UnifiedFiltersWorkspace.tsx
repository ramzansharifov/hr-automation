import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  FiBriefcase,
  FiCalendar,
  FiClipboard,
  FiFilter,
  FiLayers,
  FiRotateCcw,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { HrFilterCondition, HrRecord } from "../../../shared/types/hr";
import {
  Button,
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

const moduleTabs: Array<{
  id: FilterModule;
  label: string;
  icon: typeof FiUsers;
  description: string;
}> = [
  { id: "employees", label: "Сотрудники", icon: FiUsers, description: "Поиск сотрудников по кадровым и контактным данным." },
  { id: "enterprises", label: "Предприятия", icon: FiLayers, description: "Фильтрация предприятий по наименованию и контактам." },
  { id: "vacations", label: "Отпуска", icon: FiCalendar, description: "Отбор отпусков по сотруднику, типу, статусу и датам." },
  { id: "vacancies", label: "Вакансии", icon: FiBriefcase, description: "Отбор вакансий по структуре, статусу и формату занятости." },
  { id: "candidates", label: "Кандидаты", icon: FiClipboard, description: "Отбор кандидатов по вакансии, этапу и соответствию." },
];

const vacancyStatusOptions: SelectOption[] = [
  { value: "open", label: "Открыта" },
  { value: "draft", label: "Черновик" },
  { value: "paused", label: "Приостановлена" },
  { value: "closed", label: "Закрыта" },
];
const employmentTypeOptions: SelectOption[] = [
  { value: "full_time", label: "Полная занятость" },
  { value: "part_time", label: "Частичная занятость" },
  { value: "temporary", label: "Временная работа" },
  { value: "internship", label: "Стажировка" },
];
const candidateStatusOptions: SelectOption[] = [
  { value: "new", label: "Новый" },
  { value: "screening", label: "Первичный отбор" },
  { value: "interview", label: "Собеседование" },
  { value: "offer", label: "Оффер" },
  { value: "hired", label: "Принят" },
  { value: "rejected", label: "Отклонён" },
];
const vacationStatusOptions: SelectOption[] = [
  { value: "planned", label: "Запланирован" },
  { value: "approved", label: "Согласован" },
  { value: "rejected", label: "Отклонён" },
  { value: "completed", label: "Завершён" },
];
const paidOptions: SelectOption[] = [
  { value: "1", label: "Оплачиваемый" },
  { value: "0", label: "Неоплачиваемый" },
];

export function UnifiedFiltersWorkspace(): JSX.Element {
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
      .catch(() => active && toast.error("Не удалось загрузить данные для фильтров"));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeModule !== "candidates") return;
    setIsRecruitmentLoading(true);
    hrApiClient
      .listCandidates({})
      .then(setCandidates)
      .catch(() => toast.error("Не удалось загрузить кандидатов"))
      .finally(() => setIsRecruitmentLoading(false));
  }, [activeModule]);

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

        <div className="app-border-soft flex flex-col gap-3 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.16em]">Параметры выборки</p>
            <h2 className="app-text mt-1 text-xl font-black">{activeTab.label}</h2>
            <p className="app-muted mt-1 text-sm">{activeTab.description}</p>
          </div>
          <div className="app-accent-soft flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black">
            <FiFilter className="h-4 w-4" />
            Условий: {activeCount}
          </div>
        </div>

        <form className="p-5 sm:p-7" onSubmit={applyFilters}>
          {activeModule === "employees" && (
            <FilterGrid>
              <FilterInput label="Фамилия" value={employeeFilters.last_name} onChange={(value) => setEmployeeFilters((v) => ({ ...v, last_name: value }))} />
              <FilterInput label="Имя" value={employeeFilters.first_name} onChange={(value) => setEmployeeFilters((v) => ({ ...v, first_name: value }))} />
              <FilterInput label="Отчество" value={employeeFilters.middle_name} onChange={(value) => setEmployeeFilters((v) => ({ ...v, middle_name: value }))} />
              <FilterInput label="Телефон" value={employeeFilters.phone} onChange={(value) => setEmployeeFilters((v) => ({ ...v, phone: value }))} />
              <FilterInput label="Email" value={employeeFilters.email} onChange={(value) => setEmployeeFilters((v) => ({ ...v, email: value }))} />
              <FilterSelect label="Отдел" disabled={isRelationsLoading} options={departments} value={employeeFilters.department_id} onValueChange={(value) => setEmployeeFilters((v) => ({ ...v, department_id: value }))} />
              <FilterSelect label="Должность" disabled={isRelationsLoading} options={positions} value={employeeFilters.position_id} onValueChange={(value) => setEmployeeFilters((v) => ({ ...v, position_id: value }))} />
              <FilterSelect label="Статус" options={statusOptions} value={employeeFilters.status} onValueChange={(value) => setEmployeeFilters((v) => ({ ...v, status: value }))} />
              <FilterSelect label="Пол" options={genderOptions} value={employeeFilters.gender} onValueChange={(value) => setEmployeeFilters((v) => ({ ...v, gender: value }))} />
            </FilterGrid>
          )}

          {activeModule === "enterprises" && (
            <FilterGrid>
              <FilterInput label="Название" value={enterpriseFilters.name} onChange={(value) => setEnterpriseFilters((v) => ({ ...v, name: value }))} />
              <FilterInput label="Юридическое наименование" value={enterpriseFilters.legal_name} onChange={(value) => setEnterpriseFilters((v) => ({ ...v, legal_name: value }))} />
              <FilterInput label="Телефон" value={enterpriseFilters.phone} onChange={(value) => setEnterpriseFilters((v) => ({ ...v, phone: value }))} />
              <FilterInput label="Email" value={enterpriseFilters.email} onChange={(value) => setEnterpriseFilters((v) => ({ ...v, email: value }))} />
            </FilterGrid>
          )}

          {activeModule === "vacations" && (
            <FilterGrid>
              <FilterSelect label="Сотрудник" options={employeeOptions} value={vacationFilters.employee_id} onValueChange={(value) => setVacationFilters((v) => ({ ...v, employee_id: value }))} />
              <FilterInput label="Тип отпуска" value={vacationFilters.vacation_type} onChange={(value) => setVacationFilters((v) => ({ ...v, vacation_type: value }))} />
              <FilterSelect label="Статус" options={vacationStatusOptions} value={vacationFilters.status} onValueChange={(value) => setVacationFilters((v) => ({ ...v, status: value }))} />
              <FilterSelect label="Оплачиваемость" options={paidOptions} value={vacationFilters.is_paid} onValueChange={(value) => setVacationFilters((v) => ({ ...v, is_paid: value }))} />
              <FilterInput label="Дата начала" type="date" value={vacationFilters.starts_at} onChange={(value) => setVacationFilters((v) => ({ ...v, starts_at: value }))} />
              <FilterInput label="Дата окончания" type="date" value={vacationFilters.ends_at} onChange={(value) => setVacationFilters((v) => ({ ...v, ends_at: value }))} />
            </FilterGrid>
          )}

          {activeModule === "vacancies" && (
            <FilterGrid>
              <FilterSelect label="Статус" options={vacancyStatusOptions} value={vacancyFilters.status} onValueChange={(value) => setVacancyFilters((v) => ({ ...v, status: value }))} />
              <FilterSelect label="Формат занятости" options={employmentTypeOptions} value={vacancyFilters.employment_type} onValueChange={(value) => setVacancyFilters((v) => ({ ...v, employment_type: value }))} />
              <FilterInput label="Предприятие" value={vacancyFilters.enterprise_name} onChange={(value) => setVacancyFilters((v) => ({ ...v, enterprise_name: value }))} />
              <FilterInput label="Отдел" value={vacancyFilters.department_name} onChange={(value) => setVacancyFilters((v) => ({ ...v, department_name: value }))} />
              <FilterInput label="Должность" value={vacancyFilters.position_name} onChange={(value) => setVacancyFilters((v) => ({ ...v, position_name: value }))} />
            </FilterGrid>
          )}

          {activeModule === "candidates" && (
            <FilterGrid>
              <FilterSelect label="Этап подбора" options={candidateStatusOptions} value={candidateFilters.status} onValueChange={(value) => setCandidateFilters((v) => ({ ...v, status: value }))} />
              <FilterSelect label="Вакансия" options={vacancyOptions} value={candidateFilters.vacancy_id} onValueChange={(value) => setCandidateFilters((v) => ({ ...v, vacancy_id: value }))} />
              <FilterInput label="Источник" value={candidateFilters.source} onChange={(value) => setCandidateFilters((v) => ({ ...v, source: value }))} />
              <FilterInput label="Минимальное соответствие, %" type="number" value={candidateFilters.min_match} onChange={(value) => setCandidateFilters((v) => ({ ...v, min_match: value }))} />
            </FilterGrid>
          )}

          <div className="app-border-soft mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
            <Button leftIcon={<FiRotateCcw className="h-4 w-4" />} onClick={clearFilters} type="button" variant="secondary">Очистить</Button>
            <Button leftIcon={<FiSearch className="h-4 w-4" />} type="submit" variant="primary">Применить фильтры</Button>
          </div>
        </form>
      </section>

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft border-b px-5 py-5 sm:px-7">
          <p className="app-accent-text text-xs font-black uppercase tracking-[0.16em]">Результаты</p>
          <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="app-text text-xl font-black">Таблица по запросу</h2>
              <p className="app-muted mt-1 text-sm">Данные обновляются после применения или очистки фильтров.</p>
            </div>
          </div>
        </div>
        <ResultsPanel
          activeModule={activeModule}
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
}: {
  activeModule: FilterModule;
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
    return <div className="p-12"><LoadingState label="Загрузка результатов..." /></div>;
  }
  const rows = activeModule === "vacancies" ? filterVacancies(vacancies, vacancyFilters) : filterCandidates(candidates, candidateFilters);
  if (rows.length === 0) {
    return <div className="py-14"><EmptyState title="Ничего не найдено" description="Измените условия фильтрации и повторите поиск." /></div>;
  }
  return <SimpleResultsTable module={activeModule} rows={rows} />;
}

function SimpleResultsTable({ module, rows }: { module: "vacancies" | "candidates"; rows: HrRecord[] }): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="app-surface-muted app-muted text-xs">
            {module === "vacancies" ? (
              <>
                <TableHead>Должность</TableHead><TableHead>Предприятие</TableHead><TableHead>Отдел</TableHead><TableHead>Статус</TableHead><TableHead>Занятость</TableHead><TableHead>Кандидатов</TableHead>
              </>
            ) : (
              <>
                <TableHead>Кандидат</TableHead><TableHead>Вакансия</TableHead><TableHead>Этап</TableHead><TableHead>Источник</TableHead><TableHead>Соответствие</TableHead><TableHead>Контакты</TableHead>
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
      <div className="app-border-soft app-muted border-t px-5 py-4 text-sm">Найдено: <span className="app-text font-black">{rows.length}</span></div>
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
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-bold">{label}</span>
      <Select allowEmpty ariaLabel={label} disabled={disabled} emptyOptionLabel="Все" onValueChange={onValueChange} options={options} placeholder="Все" value={value} />
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
    label: [row.last_name, row.first_name, row.middle_name].map((part) => String(part ?? "").trim()).filter(Boolean).join(" ") || `Сотрудник #${String(row.id ?? "")}`,
  }));
}
