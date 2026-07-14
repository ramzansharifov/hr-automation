import { useCallback, useEffect, useState } from "react";
import {
  FiBriefcase,
  FiEdit2,
  FiMapPin,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import {
  RecruitmentBadge,
  RecruitmentPageHeader,
  RecruitmentSearch,
} from "../../features/recruitment/RecruitmentUi";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord } from "../../shared/types/hr";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  LoadingState,
} from "../../shared/ui";

export function VacanciesPage(): JSX.Element {
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<HrRecord[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      setVacancies(await hrApiClient.listVacancies({ search }));
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить вакансии"));
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadData(), 180);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

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

  return (
    <div className="space-y-6">
      <RecruitmentPageHeader
        actionLabel="Создать вакансию"
        description="Открытые должности, формат занятости и отдельные требования по hard и soft skills."
        icon={<FiBriefcase className="h-6 w-6" />}
        onAction={() => navigate("/vacancies/new")}
        title="Вакансии"
      />
      <RecruitmentSearch
        onChange={setSearch}
        placeholder="Поиск по должности, отделу, предприятию или навыку"
        value={search}
      />

      {isLoading ? (
        <LoadingState label="Загрузка вакансий..." />
      ) : vacancies.length === 0 ? (
        <div className="app-surface app-border rounded-[28px] border py-12">
          <EmptyState
            title="Вакансий пока нет"
            description="Создайте первую вакансию и разделите требования на hard и soft skills."
          />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {vacancies.map((vacancy) => (
            <VacancyCard
              key={String(vacancy.id)}
              onDelete={() => setDeleteTarget(vacancy)}
              onEdit={() => navigate(`/vacancies/${String(vacancy.id)}/edit`)}
              vacancy={vacancy}
            />
          ))}
        </div>
      )}

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
