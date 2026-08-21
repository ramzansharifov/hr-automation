import { useCallback, useEffect, useState } from "react";
import {
  FiBriefcase,
  FiEdit2,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import {
  RecruitmentBadge,
  RecruitmentPageHeader,
} from "../../features/recruitment/RecruitmentUi";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord } from "../../shared/types/hr";
import {
  Button,
  ConfirmDialog,
  DataTable,
  IconButton,
  useStoredViewMode,
  type DataTableColumn,
} from "../../shared/ui";

export function VacanciesPage(): JSX.Element {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("recruitment.manage");
  const [viewMode, setViewMode] = useStoredViewMode("vacancies");
  const [vacancies, setVacancies] = useState<HrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);

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

  async function deleteVacancy(): Promise<void> {
    if (!deleteTarget || !canManage) return;
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

  function openVacancy(vacancy: HrRecord): void {
    navigate(`/vacancies/${String(vacancy.id)}`);
  }

  function editVacancy(vacancy: HrRecord): void {
    if (!canManage) return;
    navigate(`/vacancies/${String(vacancy.id)}/edit`);
  }

  function renderActions(vacancy: HrRecord): JSX.Element {
    return (
      <>
        <IconButton
          icon={<FiEdit2 />}
          label="Редактировать вакансию"
          onClick={() => editVacancy(vacancy)}
          size="sm"
        />
        <IconButton
          icon={<FiTrash2 />}
          label="Удалить вакансию"
          onClick={() => setDeleteTarget(vacancy)}
          size="sm"
          tone="danger"
        />
      </>
    );
  }

  const columns: DataTableColumn<HrRecord>[] = [
    {
      key: "position",
      header: "Должность",
      render: (vacancy) => (
        <span className="app-text font-black">
          {String(vacancy.position_name ?? "Должность не указана")}
        </span>
      ),
    },
    {
      key: "structure",
      header: "Структура",
      render: (vacancy) => (
        <span className="app-text-soft">
          {[vacancy.enterprise_name, vacancy.department_name]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Статус",
      render: (vacancy) => (
        <RecruitmentBadge tone={vacancy.status === "open" ? "success" : "neutral"}>
          {vacancyStatusLabel(String(vacancy.status))}
        </RecruitmentBadge>
      ),
    },
    {
      key: "employment",
      header: "Занятость",
      render: (vacancy) => (
        <span className="app-text-soft">
          {employmentTypeLabel(String(vacancy.employment_type))}
        </span>
      ),
    },
    {
      key: "openings",
      header: "Мест",
      align: "center",
      render: (vacancy) => (
        <span className="app-text font-black">{String(vacancy.openings_count ?? 1)}</span>
      ),
    },
    {
      key: "candidates",
      header: "Кандидатов",
      align: "center",
      render: (vacancy) => (
        <span className="app-text font-black">{String(vacancy.candidates_count ?? 0)}</span>
      ),
    },
    {
      key: "skills",
      header: "Навыков",
      align: "center",
      render: (vacancy) => (
        <span className="app-text-soft">{String(vacancy.skills_count ?? 0)}</span>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Действия",
            align: "center" as const,
            render: (vacancy: HrRecord) => (
              <div
                className="flex items-center justify-center gap-2"
                onClick={(event) => event.stopPropagation()}
              >
                {renderActions(vacancy)}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <RecruitmentPageHeader
        actionLabel={canManage ? "Создать вакансию" : undefined}
        description="Открытые должности, формат занятости и требования по hard и soft skills."
        icon={<FiBriefcase className="h-6 w-6" />}
        onAction={canManage ? () => navigate("/vacancies/new") : undefined}
        title="Вакансии"
      />

      <DataTable
        ariaLabel="Реестр вакансий"
        card={{
          leading: () => <FiBriefcase className="h-5 w-5" />,
          title: (vacancy) => String(vacancy.position_name ?? "Должность не указана"),
          meta: (vacancy) => (
            <>
              <span className="app-text-soft">
                <span className="app-muted">Структура: </span>
                {[vacancy.enterprise_name, vacancy.department_name].filter(Boolean).join(" · ") || "—"}
              </span>
              <RecruitmentBadge tone={vacancy.status === "open" ? "success" : "neutral"}>
                {vacancyStatusLabel(String(vacancy.status))}
              </RecruitmentBadge>
              <span className="app-text-soft">
                <span className="app-muted">Занятость: </span>
                {employmentTypeLabel(String(vacancy.employment_type))}
              </span>
              <span className="app-text-soft">
                <span className="app-muted">Кандидатов: </span>
                {String(vacancy.candidates_count ?? 0)}
              </span>
            </>
          ),
          actions: canManage ? (vacancy) => renderActions(vacancy) : undefined,
        }}
        columns={columns}
        emptyDescription={
          canManage
            ? "Создайте первую вакансию, выбрав предприятие, отдел и должность."
            : "В доступной области пока нет вакансий."
        }
        emptyTitle="Вакансий пока нет"
        footer={
          <>
            Всего: <span className="app-text font-black">{vacancies.length}</span>
          </>
        }
        getRowKey={(vacancy) => String(vacancy.id)}
        isLoading={isLoading}
        loadingLabel="Загрузка вакансий..."
        onRowClick={openVacancy}
        onViewModeChange={setViewMode}
        rows={vacancies}
        toolbar={
          <Button
            leftIcon={
              <FiRefreshCw
                className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
            }
            onClick={() => void loadData()}
            type="button"
            variant="secondary"
          >
            Обновить
          </Button>
        }
        viewMode={viewMode}
      />

      {canManage && (
        <ConfirmDialog
          cancelLabel="Отмена"
          confirmLabel="Удалить"
          description="Вакансия и её профиль навыков будут удалены. Вакансию с кандидатами удалить нельзя."
          isLoading={isDeleting}
          onConfirm={() => void deleteVacancy()}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          open={Boolean(deleteTarget)}
          title="Удалить вакансию?"
        />
      )}
    </div>
  );
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
