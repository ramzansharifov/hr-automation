import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  FiBriefcase,
  FiCalendar,
  FiLayers,
  FiMail,
  FiMapPin,
  FiSearch,
  FiShield,
  FiUser,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../features/auth/AuthContext";
import { hrApiClient } from "../shared/lib/hrApiClient";
import { formatDate } from "../shared/lib/format";
import type {
  EmployeeWorkspaceData,
  EmployeeWorkspacePerson,
} from "../shared/types/employeeWorkspace";
import {
  Button,
  EmptyState,
  Input,
  LoadingState,
  Select,
  type SelectOption,
} from "../shared/ui";

export function EmployeeWorkspacePage(): JSX.Element {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [workspace, setWorkspace] = useState<EmployeeWorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  useEffect(() => {
    let isActive = true;

    async function loadWorkspace(): Promise<void> {
      setIsLoading(true);
      try {
        const data = await hrApiClient.getEmployeeWorkspace();
        if (isActive) setWorkspace(data);
      } catch (error) {
        if (isActive) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить рабочее пространство",
          );
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadWorkspace();
    return () => {
      isActive = false;
    };
  }, []);

  const departmentOptions = useMemo<SelectOption[]>(() => {
    if (!workspace) return [{ value: "all", label: "Все отделы" }];
    const departments = new Map<number, string>();
    if (workspace.department) {
      departments.set(workspace.department.id, workspace.department.name);
    }
    workspace.colleagues.forEach((person) => {
      if (person.departmentId && person.departmentName) {
        departments.set(person.departmentId, person.departmentName);
      }
    });
    return [
      { value: "all", label: "Все отделы" },
      ...Array.from(departments.entries())
        .sort((left, right) => left[1].localeCompare(right[1], "ru"))
        .map(([id, name]) => ({ value: String(id), label: name })),
    ];
  }, [workspace]);

  const visibleColleagues = useMemo(() => {
    if (!workspace) return [];
    const query = search.trim().toLocaleLowerCase("ru-RU");
    return workspace.colleagues.filter((person) => {
      if (
        departmentFilter !== "all" &&
        String(person.departmentId ?? "") !== departmentFilter
      ) {
        return false;
      }
      if (!query) return true;
      return [
        person.fullName,
        person.email,
        person.positionName,
        person.departmentName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(query));
    });
  }, [departmentFilter, search, workspace]);

  if (isLoading) return <LoadingState label="Загрузка вашей команды..." />;

  if (!workspace) {
    return (
      <EmptyState
        title="Рабочее пространство недоступно"
        description="Не удалось получить данные о вашей организации. Обратитесь к администратору."
      />
    );
  }

  const ownDepartmentColleagues = workspace.colleagues.filter(
    (person) =>
      workspace.self.departmentId &&
      person.departmentId === workspace.self.departmentId,
  ).length;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      initial={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <section className="app-accent-gradient-panel overflow-hidden rounded-[30px] border border-white/10 p-6 text-white shadow-2xl sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg font-black backdrop-blur">
              {initials(workspace.self.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">
                Моё рабочее пространство
              </p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                {workspace.self.fullName}
              </h1>
              <p className="mt-2 text-sm font-semibold text-white/75">
                {[
                  workspace.self.positionName,
                  workspace.self.departmentName,
                  workspace.self.enterpriseName,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Организационная привязка пока не настроена"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {hasPermission("profile.view") && (
              <Button
                className="border-white/20 bg-white/10 text-white hover:bg-white/15"
                leftIcon={<FiUser className="h-4 w-4" />}
                onClick={() => navigate("/profile")}
                variant="ghost"
              >
                Мой профиль
              </Button>
            )}
            {hasPermission("vacations.view") && (
              <Button
                className="border-white/20"
                leftIcon={<FiCalendar className="h-4 w-4" />}
                onClick={() => navigate("/vacations")}
                style={{ background: "#ffffff", color: "#0f172a" }}
                variant="ghost"
              >
                Мои отпуска
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<FiLayers />}
          label="Предприятие"
          value={workspace.enterprise?.name ?? "Не назначено"}
        />
        <MetricCard
          icon={<FiBriefcase />}
          label="Отдел"
          value={workspace.department?.name ?? "Не назначен"}
        />
        <MetricCard
          icon={<FiUsers />}
          label="Коллег в моём отделе"
          value={ownDepartmentColleagues}
        />
        <MetricCard
          icon={<FiUsers />}
          label="Коллег в предприятии"
          value={workspace.colleagues.length}
        />
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-2">
        <InfoPanel icon={<FiLayers />} title="Моё место в структуре">
          <InfoRow label="Предприятие" value={workspace.enterprise?.name} />
          <InfoRow label="Юридическое название" value={workspace.enterprise?.legalName} />
          <InfoRow label="Отдел" value={workspace.department?.name} />
          <InfoRow label="Должность" value={workspace.self.positionName} />
          <InfoRow
            label="Дата начала работы"
            value={workspace.self.hireDate ? formatDate(workspace.self.hireDate) : null}
          />
          <InfoRow label="Тип занятости" value={employmentTypeLabel(workspace.self.employmentType)} />
          <InfoRow label="Рабочее место" value={workspace.self.workplace} />
        </InfoPanel>

        <InfoPanel icon={<FiMapPin />} title="Контакты организации">
          <InfoRow label="Адрес предприятия" value={workspace.enterprise?.address} wide />
          <InfoRow label="Почта предприятия" value={workspace.enterprise?.email} />
          <InfoRow label="Телефон предприятия" value={workspace.enterprise?.phone} />
          <InfoRow label="Расположение отдела" value={workspace.department?.location} wide />
          <InfoRow label="Почта отдела" value={workspace.department?.email} />
          <InfoRow label="Телефон отдела" value={workspace.department?.phone} />
        </InfoPanel>
      </section>

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <SectionHeader
          description="Люди, которые отвечают за ваш отдел и предприятие. Доступны только рабочие контактные данные."
          icon={<FiUserCheck />}
          title="Руководители"
        />
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
          <LeaderCard
            label="Начальник отдела"
            person={workspace.departmentLeader}
          />
          <LeaderCard
            label="Руководитель предприятия"
            person={workspace.enterpriseLeader}
          />
        </div>
      </section>

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <SectionHeader
          description="Справочник активных сотрудников вашего предприятия. Зарплата, телефоны, адреса, документы и кадровые данные коллег здесь не раскрываются."
          icon={<FiUsers />}
          title="Коллеги"
        />

        <div className="app-border-soft flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative w-full sm:max-w-md">
            <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              className="pl-11"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по ФИО, почте или должности"
              value={search}
            />
          </div>
          <Select
            ariaLabel="Фильтр по отделу"
            className="w-full sm:w-64"
            onValueChange={setDepartmentFilter}
            options={departmentOptions}
            value={departmentFilter}
          />
        </div>

        <div className="app-surface-muted app-border-soft mx-4 mt-4 flex items-start gap-3 rounded-2xl border p-4 sm:mx-5">
          <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            <FiShield />
          </span>
          <div>
            <p className="app-text text-sm font-black">Безопасный внутренний справочник</p>
            <p className="app-muted mt-1 text-xs font-semibold leading-5">
              По коллегам показываются только ФИО, рабочая почта, должность и отдел — данные, необходимые для внутренней коммуникации.
            </p>
          </div>
        </div>

        {visibleColleagues.length ? (
          <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleColleagues.map((person) => (
              <ColleagueCard
                isOwnDepartment={person.departmentId === workspace.self.departmentId}
                key={person.id}
                person={person}
              />
            ))}
          </div>
        ) : (
          <div className="app-muted p-10 text-center text-sm font-semibold">
            По выбранным условиям коллеги не найдены.
          </div>
        )}
      </section>
    </motion.div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[24px] border p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="app-muted text-[10px] font-black uppercase tracking-wide">{label}</p>
          <p className="app-text mt-1 break-words text-lg font-black">{value}</p>
        </div>
      </div>
    </article>
  );
}

function InfoPanel({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }): JSX.Element {
  return (
    <section className="app-surface app-border overflow-hidden rounded-[28px] border">
      <SectionHeader description="" icon={icon} title={title} />
      <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function InfoRow({ label, value, wide = false }: { label: string; value?: ReactNode | null; wide?: boolean }): JSX.Element {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="app-muted text-[10px] font-black uppercase tracking-wide">{label}</p>
      <p className="app-text-soft mt-1.5 break-words text-sm font-bold leading-6">{value || "—"}</p>
    </div>
  );
}

function SectionHeader({ description, icon, title }: { description: string; icon: ReactNode; title: string }): JSX.Element {
  return (
    <div className="app-surface-muted app-border flex items-center gap-3 border-b px-5 py-4">
      <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">{icon}</span>
      <div>
        <h2 className="app-text text-lg font-black">{title}</h2>
        {description && <p className="app-muted mt-0.5 text-xs font-semibold leading-5">{description}</p>}
      </div>
    </div>
  );
}

function LeaderCard({ label, person }: { label: string; person: EmployeeWorkspacePerson | null }): JSX.Element {
  return (
    <article className="app-surface-muted app-border rounded-2xl border p-4">
      <div className="flex items-start gap-3">
        <span className="app-accent-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-sm font-black">
          {person ? initials(person.fullName) : <FiUserCheck />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="app-muted text-[10px] font-black uppercase tracking-wide">{label}</p>
          <p className="app-text mt-1 text-sm font-black">{person?.fullName ?? "Не назначен"}</p>
          {person?.positionName && (
            <p className="app-text-soft mt-1 text-xs font-bold">{person.positionName}</p>
          )}
          {person?.departmentName && (
            <p className="app-muted mt-1 text-xs font-semibold">{person.departmentName}</p>
          )}
          {person?.email && (
            <p className="app-accent-text mt-3 flex items-center gap-2 break-all text-xs font-bold">
              <FiMail className="h-4 w-4 shrink-0" /> {person.email}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function ColleagueCard({
  isOwnDepartment,
  person,
}: {
  isOwnDepartment: boolean;
  person: EmployeeWorkspacePerson;
}): JSX.Element {
  return (
    <article className="app-surface-muted app-border rounded-2xl border p-4 transition hover:border-[var(--accent-border)] hover:shadow-lg">
      <div className="flex items-start gap-3">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xs font-black">
          {initials(person.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="app-text min-w-0 font-black">{person.fullName}</p>
            {isOwnDepartment && (
              <span className="app-accent-soft rounded-full border px-2.5 py-1 text-[10px] font-black">Мой отдел</span>
            )}
          </div>
          <p className="app-text-soft mt-2 text-xs font-bold">{person.positionName ?? "Должность не указана"}</p>
          <p className="app-muted mt-1 text-xs font-semibold">{person.departmentName ?? "Отдел не указан"}</p>
          {person.email && (
            <p className="app-accent-text mt-3 flex items-center gap-2 break-all text-xs font-bold">
              <FiMail className="h-4 w-4 shrink-0" /> {person.email}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function employmentTypeLabel(value: string | null): string {
  const labels: Record<string, string> = {
    full_time: "Полная занятость",
    part_time: "Частичная занятость",
    temporary: "Временная работа",
    internship: "Стажировка",
  };
  return value ? labels[value] ?? value : "—";
}

function initials(value: string): string {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0] ?? "")
      .join("")
      .toUpperCase() || "HR"
  );
}
