import { useEffect, useState } from "react";
import {
  FiBriefcase,
  FiEdit2,
  FiMail,
  FiMapPin,
  FiPhone,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { HrEntityDialog } from "../features/hr-entities/components/HrEntityDialog";
import { getScopedAdminRole } from "../shared/access/scopedAdmin";
import { formatDate } from "../shared/lib/format";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { HrRecord } from "../shared/types/hr";
import {
  Button,
  EmptyState,
  LoadingState,
  PageHeader,
} from "../shared/ui";
import { EmployeeWorkspacePage } from "./EmployeeWorkspacePage";

export function DepartmentWorkspaceRoutePage(): JSX.Element {
  const { session } = useAuth();
  const scopedAdminRole = getScopedAdminRole(session.roles);

  if (scopedAdminRole !== "department_admin") {
    return <EmployeeWorkspacePage section="department" />;
  }

  return <DepartmentAdminWorkspace />;
}

function DepartmentAdminWorkspace(): JSX.Element {
  const navigate = useNavigate();
  const { hasPermission, session } = useAuth();
  const [department, setDepartment] = useState<HrRecord | null>(null);
  const [enterprise, setEnterprise] = useState<HrRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const canEdit = hasPermission("organization.edit");

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      if (!session.departmentId || !session.enterpriseId) {
        setDepartment(null);
        setEnterprise(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [departmentRecord, enterpriseRecord] = await Promise.all([
          hrApiClient.getById({ entity: "departments", id: session.departmentId }),
          hrApiClient.getById({ entity: "enterprises", id: session.enterpriseId }),
        ]);
        if (!active) return;
        setDepartment(departmentRecord);
        setEnterprise(enterpriseRecord);
      } catch (error) {
        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить отдел",
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [refreshIndex, session.departmentId, session.enterpriseId]);

  if (isLoading) return <LoadingState label="Загрузка отдела..." />;

  if (!session.departmentId || !session.enterpriseId || !department) {
    return (
      <EmptyState
        title="Отдел не определён"
        description="Администратор отдела должен быть привязан к конкретному подразделению. Проверьте кадровую привязку сотрудника."
      />
    );
  }

  async function saveDepartment(data: HrRecord): Promise<void> {
    await hrApiClient.update({
      entity: "departments",
      id: session.departmentId!,
      data: {
        ...data,
        enterprise_id: session.enterpriseId!,
      },
    });
    setRefreshIndex((value) => value + 1);
  }

  const departmentName = String(
    department.name ?? session.departmentName ?? "Отдел",
  );
  const enterpriseName = String(
    enterprise?.name ?? session.enterpriseName ?? "Предприятие",
  );
  const detailsPath = `/enterprises/${session.enterpriseId}/departments/${session.departmentId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              className="border-white/20 bg-white/10 text-white"
              leftIcon={<FiBriefcase className="h-4 w-4" />}
              onClick={() => navigate(detailsPath)}
              variant="ghost"
            >
              Должности и руководитель
            </Button>
            {canEdit && (
              <Button
                className="border-white/20 shadow-xl hover:opacity-90"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => setIsEditOpen(true)}
                style={{ background: "#ffffff", color: "#0f172a" }}
                variant="ghost"
              >
                Редактировать отдел
              </Button>
            )}
          </div>
        }
        description="Управление данными, сотрудниками, должностями и кадровыми процессами только в пределах вашего отдела."
        eyebrow="Администрирование отдела"
        icon={<FiBriefcase />}
        title={departmentName}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="app-surface app-border rounded-[28px] border p-6">
          <p className="app-muted text-xs font-black uppercase tracking-[0.14em]">
            Данные подразделения
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Info label="Предприятие" value={enterpriseName} />
            <Info label="Руководитель" value={department.director_name} />
            <Info label="Расположение" value={department.location} />
            <Info
              label="Дата создания"
              value={department.created_on ? formatDate(String(department.created_on)) : null}
            />
          </div>
        </article>

        <article className="app-surface app-border rounded-[28px] border p-6">
          <p className="app-muted text-xs font-black uppercase tracking-[0.14em]">
            Контакты
          </p>
          <div className="mt-5 space-y-4">
            <Contact icon={<FiPhone />} label="Телефон" value={department.phone} />
            <Contact icon={<FiMail />} label="Email" value={department.email} />
            <Contact icon={<FiMapPin />} label="Локация" value={department.location} />
          </div>
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <QuickAction
          description="Добавление и изменение должностей, а также назначение руководителя этого подразделения."
          icon={<FiUserCheck />}
          label="Структура отдела"
          onClick={() => navigate(detailsPath)}
        />
        <QuickAction
          description="Добавление сотрудников и кадровые действия только внутри текущего отдела."
          icon={<FiUsers />}
          label="Сотрудники отдела"
          onClick={() => navigate("/employees")}
        />
      </section>

      {canEdit && (
        <HrEntityDialog
          entity="departments"
          hiddenFieldNames={["enterprise_id"]}
          initialRecord={department}
          mode="edit"
          onOpenChange={setIsEditOpen}
          onSubmit={saveDepartment}
          open={isEditOpen}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: unknown }): JSX.Element {
  return (
    <div>
      <p className="app-muted text-[11px] font-black uppercase tracking-wide">{label}</p>
      <p className="app-text mt-1.5 break-words text-sm font-bold">
        {String(value ?? "").trim() || "—"}
      </p>
    </div>
  );
}

function Contact({
  icon,
  label,
  value,
}: {
  icon: JSX.Element;
  label: string;
  value: unknown;
}): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="app-muted text-[10px] font-black uppercase tracking-wide">{label}</p>
        <p className="app-text mt-1 break-words text-sm font-bold">
          {String(value ?? "").trim() || "—"}
        </p>
      </div>
    </div>
  );
}

function QuickAction({
  description,
  icon,
  label,
  onClick,
}: {
  description: string;
  icon: JSX.Element;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className="app-surface app-border group rounded-[24px] border p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:shadow-lg"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start gap-4">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg">
          {icon}
        </span>
        <div>
          <p className="app-text font-black transition group-hover:text-[var(--accent)]">
            {label}
          </p>
          <p className="app-muted mt-1 text-xs font-semibold leading-5">{description}</p>
        </div>
      </div>
    </button>
  );
}
