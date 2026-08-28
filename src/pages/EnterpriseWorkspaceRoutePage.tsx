import { useEffect, useState } from "react";
import {
  FiEdit2,
  FiGrid,
  FiLayers,
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
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { HrRecord } from "../shared/types/hr";
import {
  Button,
  EmptyState,
  LoadingState,
  PageHeader,
} from "../shared/ui";
import { EmployeeWorkspacePage } from "./EmployeeWorkspacePage";

export function EnterpriseWorkspaceRoutePage(): JSX.Element {
  const { session } = useAuth();
  const scopedAdminRole = getScopedAdminRole(session.roles);

  if (scopedAdminRole !== "enterprise_admin") {
    return <EmployeeWorkspacePage section="enterprise" />;
  }

  return <EnterpriseAdminWorkspace />;
}

function EnterpriseAdminWorkspace(): JSX.Element {
  const navigate = useNavigate();
  const { hasPermission, session } = useAuth();
  const [enterprise, setEnterprise] = useState<HrRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const canEdit = hasPermission("enterprises.edit");

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      if (!session.enterpriseId) {
        setEnterprise(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const record = await hrApiClient.getById({
          entity: "enterprises",
          id: session.enterpriseId,
        });
        if (active) setEnterprise(record);
      } catch (error) {
        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить предприятие",
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
  }, [refreshIndex, session.enterpriseId]);

  if (isLoading) return <LoadingState label="Загрузка предприятия..." />;

  if (!session.enterpriseId || !enterprise) {
    return (
      <EmptyState
        title="Предприятие не определено"
        description="Администратор предприятия должен быть привязан к конкретному предприятию. Проверьте кадровую привязку сотрудника."
      />
    );
  }

  async function saveEnterprise(data: HrRecord): Promise<void> {
    await hrApiClient.update({
      entity: "enterprises",
      id: session.enterpriseId!,
      data,
    });
    setRefreshIndex((value) => value + 1);
  }

  const enterpriseName = String(enterprise.name ?? session.enterpriseName ?? "Предприятие");
  const enterpriseDetailsPath = `/enterprises/${session.enterpriseId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              className="border-white/20 bg-white/10 text-white"
              leftIcon={<FiUserCheck className="h-4 w-4" />}
              onClick={() => navigate(enterpriseDetailsPath)}
              variant="ghost"
            >
              Руководитель и структура
            </Button>
            <Button
              className="border-white/20 bg-white/10 text-white"
              leftIcon={<FiGrid className="h-4 w-4" />}
              onClick={() => navigate("/management/departments")}
              variant="ghost"
            >
              Отделы
            </Button>
            {canEdit && (
              <Button
                className="border-white/20 shadow-xl hover:opacity-90"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => setIsEditOpen(true)}
                style={{ background: "#ffffff", color: "#0f172a" }}
                variant="ghost"
              >
                Редактировать предприятие
              </Button>
            )}
          </div>
        }
        description="Карточка юридического лица и быстрый переход к управлению всеми данными, относящимися к вашему предприятию."
        eyebrow="Администрирование предприятия"
        icon={<FiLayers />}
        title={enterpriseName}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="app-surface app-border rounded-[28px] border p-6">
          <p className="app-muted text-xs font-black uppercase tracking-[0.14em]">
            Юридические данные
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Info label="Категория" value={enterprise.legal_form} />
            <Info label="Юридическое название" value={enterprise.legal_name} />
            <Info label="Регистрационный номер" value={enterprise.registration_number} />
            <Info label="Руководитель" value={enterprise.general_director_name} />
          </div>
        </article>

        <article className="app-surface app-border rounded-[28px] border p-6">
          <p className="app-muted text-xs font-black uppercase tracking-[0.14em]">
            Контакты
          </p>
          <div className="mt-5 space-y-4">
            <Contact icon={<FiPhone />} label="Телефон" value={enterprise.phone} />
            <Contact icon={<FiMail />} label="Email" value={enterprise.email} />
            <Contact icon={<FiMapPin />} label="Адрес" value={enterprise.address} />
          </div>
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <QuickAction
          description="Назначение руководителя предприятия и полный просмотр организационной структуры."
          icon={<FiUserCheck />}
          label="Руководитель и структура"
          onClick={() => navigate(enterpriseDetailsPath)}
        />
        <QuickAction
          description="Создание отделов, изменение их данных, должностей и назначение руководителей."
          icon={<FiGrid />}
          label="Управление отделами"
          onClick={() => navigate("/management/departments")}
        />
        <QuickAction
          description="Добавление сотрудников и все кадровые действия в пределах предприятия."
          icon={<FiUsers />}
          label="Сотрудники предприятия"
          onClick={() => navigate("/employees")}
        />
      </section>

      {canEdit && (
        <HrEntityDialog
          entity="enterprises"
          initialRecord={enterprise}
          mode="edit"
          onOpenChange={setIsEditOpen}
          onSubmit={saveEnterprise}
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
