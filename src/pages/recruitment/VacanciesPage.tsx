import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiEdit2,
  FiMapPin,
  FiRefreshCw,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import {
  RecruitmentBadge,
  RecruitmentPageHeader,
} from "../../features/recruitment/RecruitmentUi";
import {
  filterVacancies,
  getStoredVacancyFilterValues,
  VACANCY_FILTERS_EVENT,
  type VacancyFilterValues,
} from "../../features/filters/moduleFiltersStore";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord } from "../../shared/types/hr";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  LoadingState,
  ViewModeToggle,
  useStoredViewMode,
} from "../../shared/ui";

export function VacanciesPage(): JSX.Element {
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<HrRecord[]>([]);
  const [filters, setFilters] = useState<VacancyFilterValues>(
    getStoredVacancyFilterValues,
  );
  const [viewMode, setViewMode] = useStoredViewMode("vacancies", "cards");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);

  const filteredVacancies = useMemo(
    () => filterVacancies(vacancies, filters),
    [filters, vacancies],
  );

  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      setVacancies(await hrApiClient.listVacancies({}));
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить вакансии"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    function refreshFilters(): void {
      setFilters(getStoredVacancyFilterValues());
    }

    window.addEventListener(VACANCY_FILTERS_EVENT, refreshFilters);
    window.addEventListener("storage", refreshFilters);
    return () => {
      window.removeEventListener(VACANCY_FILTERS_EVENT, refreshFilters);
      window.removeEventListener("storage", refreshFilters);
    };
  }, []);

  async function deleteVacancy(): Promise<void> {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await hrApiClient.deleteVacancy(Number(deleteTarget.id));
      setDeleteTarget(null);
      await loadData();
      toast.success("Вакансия удалена");
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось удалить вакансию"));
    } finally {
      setIsDeleting(false);
    }
  }

  function editVacancy(vacancy: HrRecord): void {
    navigate(`/vacancies/${String(vacancy.id)}/edit`);
  }

  return (
    <div className="space-y-6">
      <RecruitmentPageHeader
        actionLabel="Создать вакансию"
        description="Открытые должности, формат занятости и отдельные требования по hard и soft skills."
        icon={<FiBriefcase className="h-6 w-6" />}
        onAction={() => navigate("/vacancies/new")}
        title="Вакансии"
      />

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <ViewModeToggle onChange={setViewMode} value={viewMode} />
          <Button
            leftIcon={
              <FiRefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            }
            onClick={() => void loadData()}
            type="button"
            variant="secondary"
          >
            Обновить
          </Button>
        </div>

        {isLoading ? (
          <div className="px-5 py-16">
            <LoadingState label="Загрузка вакансий..." />
          </div>
        ) : filteredVacancies.length === 0 ? (
          <div className="py-16">
            <EmptyState
              title={vacancies.length === 0 ? "Вакансий пока нет" : "Нет вакансий по выбранным фильтрам"}
              description={
                vacancies.length === 0
                  ? "Создайте первую вакансию и разделите требования на hard и soft skills."
                  : "Измените или очистите фильтры в модуле «Фильтры»."
              }
            />
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid gap-5 p-5 xl:grid-cols-2">
            {filteredVacancies.map((vacancy) => (
              <VacancyCard
                key={String(vacancy.id)}
                onDelete={() => setDeleteTarget(vacancy)}
                onEdit={() => editVacancy(vacancy)}
                vacancy={vacancy}
              />
            ))}
          </div>
        ) : (
          <VacanciesTable
            onDelete={setDeleteTarget}
            onEdit={editVacancy}
            vacancies={filteredVacancies}
          />
        )}
      </section>

      <ConfirmDialog
        cancelLabel="Отмена"
        confirmLabel="Удалить"
        description="Вакансия и её навыки будут удалены. Вакансию с кандидатами удалить нельзя."
        isLoading={isDeleting}
        onConfirm={() => void deleteVacancy()}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={Boolean(deleteTarget)}
        title="Удалить вакансию?"
      />
    </div>
  );
}

function VacanciesTable({
  onDelete,
  onEdit,
  vacancies,
}: {
  onDelete: (vacancy: HrRecord) => void;
  onEdit: (vacancy: HrRecord) => void;
  vacancies: HrRecord[];
}): JSX.Element {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="app-surface-muted app-muted text-xs">
              <th className="app-border-soft border-b px-5 py-4 font-black">Должность</th>
              <th className="app-border-soft border-b px-5 py-4 font-black">Структура</th>
              <th className="app-border-soft border-b px-5 py-4 font-black">Статус</th>
              <th className="app-border-soft border-b px-5 py-4 font-black">Занятость</th>
              <th className="app-border-soft border-b px-5 py-4 font-black">Мест</th>
              <th className="app-border-soft border-b px-5 py-4 font-black">Кандидатов</th>
              <th className="app-border-soft border-b px-5 py-4 text-center font-black">Действия</th>
            </tr>
          </thead>
          <tbody>
            {vacancies.map((vacancy) => (
              <tr
                className="app-hover-muted cursor-pointer transition"
                key={String(vacancy.id)}
                onClick={() => onEdit(vacancy)}
              >
                <td className="app-border-soft app-text border-b px-5 py-4 font-black">
                  {String(vacancy.position_name ?? "Должность не указана")}
                </td>
                <td className="app-border-soft app-text-soft border-b px-5 py-4">
                  {[vacancy.enterprise_name, vacancy.department_name]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="app-border-soft border-b px-5 py-4">
                  <RecruitmentBadge tone={vacancy.status === "open" ? "success" : "neutral"}>
                    {vacancyStatusLabel(String(vacancy.status))}
                  </RecruitmentBadge>
                </td>
                <td className="app-border-soft app-text-soft border-b px-5 py-4">
                  {employmentTypeLabel(String(vacancy.employment_type))}
                </td>
                <td className="app-border-soft app-text-soft border-b px-5 py-4">
                  {String(vacancy.openings_count ?? 1)}
                </td>
                <td className="app-border-soft app-text-soft border-b px-5 py-4">
                  {String(vacancy.candidates_count ?? 0)}
                </td>
                <td className="app-border-soft border-b px-5 py-4">
                  <div
                    className="flex items-center justify-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button
                      aria-label="Редактировать вакансию"
                      className="h-9 w-9 p-0"
                      onClick={() => onEdit(vacancy)}
                      variant="ghost"
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="Удалить вакансию"
                      className="h-9 w-9 p-0"
                      onClick={() => onDelete(vacancy)}
                      variant="ghost"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="app-border-soft app-muted border-t px-5 py-4 text-sm">
        Всего: <span className="app-text font-black">{vacancies.length}</span>
      </div>
    </>
  );
}

function VacancyCard({
  onDelete,
  onEdit,
  vacancy,
}: {
  onDelete: () => void;
  onEdit: () => void;
  vacancy: HrRecord;
}): JSX.Element {
  const hardSkills = splitSkills(vacancy.hard_skills_summary);
  const softSkills = splitSkills(vacancy.soft_skills_summary);

  return (
    <article className="app-surface app-border group relative overflow-hidden rounded-[28px] border p-6 transition-colors hover:border-[var(--accent-border)]">
      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <RecruitmentBadge
              tone={vacancy.status === "open" ? "success" : "neutral"}
            >
              {vacancyStatusLabel(String(vacancy.status))}
            </RecruitmentBadge>
            <RecruitmentBadge>
              {employmentTypeLabel(String(vacancy.employment_type))}
            </RecruitmentBadge>
          </div>
          <h2 className="app-text mt-4 text-2xl font-black tracking-tight">
            {String(vacancy.position_name ?? "Должность не указана")}
          </h2>
          <p className="app-muted mt-2 flex items-center gap-2 text-sm">
            <FiMapPin className="h-4 w-4" />
            {[vacancy.enterprise_name, vacancy.department_name]
              .filter(Boolean)
              .join(" · ") || "Структура не указана"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            aria-label="Редактировать вакансию"
            className="h-10 w-10 p-0"
            onClick={onEdit}
            variant="ghost"
          >
            <FiEdit2 className="h-4 w-4" />
          </Button>
          <Button
            aria-label="Удалить вакансию"
            className="h-10 w-10 p-0"
            onClick={onDelete}
            variant="ghost"
          >
            <FiTrash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <SkillPreview label="Hard skills" skills={hardSkills} />
      <SkillPreview label="Soft skills" skills={softSkills} />

      <div className="app-border-soft app-muted mt-5 flex flex-wrap gap-5 border-t pt-4 text-sm font-bold">
        <span className="flex items-center gap-2">
          <FiUsers className="h-4 w-4" />
          Кандидатов: {String(vacancy.candidates_count ?? 0)}
        </span>
        <span>Мест: {String(vacancy.openings_count ?? 1)}</span>
        <span>Навыков: {String(vacancy.skills_count ?? 0)}</span>
      </div>
    </article>
  );
}

function SkillPreview({
  label,
  skills,
}: {
  label: string;
  skills: string[];
}): JSX.Element {
  if (skills.length === 0) return <></>;

  return (
    <div className="mt-5">
      <p className="app-muted mb-2 text-xs font-black uppercase tracking-[0.14em]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {skills.slice(0, 5).map((skill) => (
          <RecruitmentBadge key={`${label}-${skill}`} tone="accent">
            {skill}
          </RecruitmentBadge>
        ))}
        {skills.length > 5 && (
          <RecruitmentBadge>+{skills.length - 5}</RecruitmentBadge>
        )}
      </div>
    </div>
  );
}

function splitSkills(value: unknown): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const vacancyStatusOptions = [
  { value: "open", label: "Открыта" },
  { value: "draft", label: "Черновик" },
  { value: "paused", label: "Приостановлена" },
  { value: "closed", label: "Закрыта" },
];
const employmentTypeOptions = [
  { value: "full_time", label: "Полная занятость" },
  { value: "part_time", label: "Частичная занятость" },
  { value: "temporary", label: "Временная работа" },
  { value: "internship", label: "Стажировка" },
];
function vacancyStatusLabel(value: string): string {
  return vacancyStatusOptions.find((item) => item.value === value)?.label ?? value;
}
function employmentTypeLabel(value: string): string {
  return employmentTypeOptions.find((item) => item.value === value)?.label ?? value;
}
function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
