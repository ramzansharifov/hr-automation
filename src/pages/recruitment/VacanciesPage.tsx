import { useCallback, useEffect, useState } from "react";
import { FiBriefcase } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import {
  RecruitmentBadge,
  RecruitmentPageHeader,
} from "../../features/recruitment/RecruitmentUi";
import { appText, useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord } from "../../shared/types/hr";
import {
  ActionButton,
  DataTable,
  DeleteConfirmDialog,
  RecordActions,
  useStoredViewMode,
  type DataTableColumn,
} from "../../shared/ui";

export function VacanciesPage(): JSX.Element {
  const text = useAppText();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("vacancies.create");
  const canEdit = hasPermission("vacancies.edit");
  const canDelete = hasPermission("vacancies.delete");
  const [viewMode, setViewMode] = useStoredViewMode("vacancies");
  const [vacancies, setVacancies] = useState<HrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      setVacancies(await hrApiClient.listVacancies({}));
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось загрузить вакансии", "Failed to load vacancies")));
    } finally {
      setIsLoading(false);
    }
  }, [text]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function deleteVacancy(): Promise<void> {
    if (!deleteTarget || !canDelete) return;
    try {
      await hrApiClient.deleteVacancy(Number(deleteTarget.id));
      setDeleteTarget(null);
      await loadData();
      toast.success(text("Вакансия удалена", "Vacancy deleted"));
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось удалить вакансию", "Failed to delete vacancy")));
    }
  }

  function openVacancy(vacancy: HrRecord): void {
    navigate(`/vacancies/${String(vacancy.id)}`);
  }

  function renderActions(vacancy: HrRecord): JSX.Element | null {
    return (
      <RecordActions
        deleteLabel={text("Удалить вакансию", "Delete vacancy")}
        editLabel={text("Редактировать вакансию", "Edit vacancy")}
        onDelete={canDelete ? () => setDeleteTarget(vacancy) : undefined}
        onEdit={
          canEdit
            ? () => navigate(`/vacancies/${String(vacancy.id)}/edit`)
            : undefined
        }
      />
    );
  }

  const hasActions = canEdit || canDelete;
  const columns: DataTableColumn<HrRecord>[] = [
    {
      key: "position",
      header: text("Должность", "Position"),
      render: (vacancy) => (
        <span className="app-text font-black">
          {String(vacancy.position_name ?? text("Должность не указана", "Position not specified"))}
        </span>
      ),
    },
    {
      key: "structure",
      header: text("Структура", "Structure"),
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
      header: text("Статус", "Status"),
      render: (vacancy) => (
        <RecruitmentBadge tone={vacancy.status === "open" ? "success" : "neutral"}>
          {vacancyStatusLabel(String(vacancy.status))}
        </RecruitmentBadge>
      ),
    },
    {
      key: "employment",
      header: text("Занятость", "Employment"),
      render: (vacancy) => (
        <span className="app-text-soft">
          {employmentTypeLabel(String(vacancy.employment_type))}
        </span>
      ),
    },
    {
      key: "openings",
      header: text("Мест", "Openings"),
      align: "center",
      render: (vacancy) => (
        <span className="app-text font-black">{String(vacancy.openings_count ?? 1)}</span>
      ),
    },
    {
      key: "candidates",
      header: text("Кандидатов", "Candidates"),
      align: "center",
      render: (vacancy) => (
        <span className="app-text font-black">{String(vacancy.candidates_count ?? 0)}</span>
      ),
    },
    {
      key: "skills",
      header: text("Навыков", "Skills"),
      align: "center",
      render: (vacancy) => (
        <span className="app-text-soft">{String(vacancy.skills_count ?? 0)}</span>
      ),
    },
    ...(hasActions
      ? [
          {
            key: "actions",
            header: text("Действия", "Actions"),
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
        actionLabel={canCreate ? text("Создать вакансию", "Create vacancy") : undefined}
        description={text("Открытые должности, формат занятости и требования по hard и soft skills.", "Open positions, employment formats, and hard/soft skill requirements.")}
        icon={<FiBriefcase className="h-6 w-6" />}
        onAction={canCreate ? () => navigate("/vacancies/new") : undefined}
        title={text("Вакансии", "Vacancies")}
      />

      <DataTable
        ariaLabel={text("Реестр вакансий", "Vacancy registry")}
        card={{
          leading: () => <FiBriefcase className="h-5 w-5" />,
          title: (vacancy) => String(vacancy.position_name ?? text("Должность не указана", "Position not specified")),
          meta: (vacancy) => (
            <>
              <span className="app-text-soft">
                <span className="app-muted">{text("Структура:", "Structure:")} </span>
                {[vacancy.enterprise_name, vacancy.department_name].filter(Boolean).join(" · ") || "—"}
              </span>
              <RecruitmentBadge tone={vacancy.status === "open" ? "success" : "neutral"}>
                {vacancyStatusLabel(String(vacancy.status))}
              </RecruitmentBadge>
              <span className="app-text-soft">
                <span className="app-muted">{text("Занятость:", "Employment:")} </span>
                {employmentTypeLabel(String(vacancy.employment_type))}
              </span>
              <span className="app-text-soft">
                <span className="app-muted">{text("Кандидатов:", "Candidates:")} </span>
                {String(vacancy.candidates_count ?? 0)}
              </span>
            </>
          ),
          actions: hasActions ? (vacancy) => renderActions(vacancy) : undefined,
        }}
        columns={columns}
        emptyDescription={
          canCreate
            ? text("Создайте первую вакансию, выбрав предприятие, отдел и должность.", "Create the first vacancy by selecting an enterprise, department, and position.")
            : "В доступной области пока нет вакансий."
        }
        emptyTitle={text("Вакансий пока нет", "No vacancies yet")}
        footer={
          <>
            {text("Всего:", "Total:")} <span className="app-text font-black">{vacancies.length}</span>
          </>
        }
        getRowKey={(vacancy) => String(vacancy.id)}
        isLoading={isLoading}
        loadingLabel={text("Загрузка вакансий...", "Loading vacancies...")}
        onRowClick={openVacancy}
        onViewModeChange={setViewMode}
        rows={vacancies}
        toolbar={
          <ActionButton
            action="refresh"
            loading={isLoading}
            onClick={() => void loadData()}
            type="button"
          />
        }
        viewMode={viewMode}
      />

      {canDelete && (
        <DeleteConfirmDialog
          description={text("Вакансия и её профиль навыков будут удалены. Вакансию с кандидатами удалить нельзя.", "The vacancy and its skill profile will be deleted. A vacancy with candidates cannot be deleted.")}
          onConfirm={deleteVacancy}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          open={Boolean(deleteTarget)}
          title={text("Удалить вакансию?", "Delete vacancy?")}
        />
      )}
    </div>
  );
}

function vacancyStatusLabel(value: string): string {
  const labels: Record<string, [string, string]> = {
    open: ["Открыта", "Open"],
    draft: ["Черновик", "Draft"],
    paused: ["Приостановлена", "Paused"],
    closed: ["Закрыта", "Closed"],
  };
  const label = labels[value];
  return label ? appText(label[0], label[1]) : value;
}

function employmentTypeLabel(value: string): string {
  const labels: Record<string, [string, string]> = {
    full_time: ["Полная занятость", "Full-time"],
    part_time: ["Частичная занятость", "Part-time"],
    temporary: ["Временная работа", "Temporary"],
    internship: ["Стажировка", "Internship"],
  };
  const label = labels[value];
  return label ? appText(label[0], label[1]) : value;
}

function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
