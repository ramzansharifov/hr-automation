import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  FiBriefcase,
  FiLayers,
  FiMail,
  FiMapPin,
  FiSearch,
  FiShield,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { useAppLocale, useAppText } from "../shared/i18n";
import { formatDate } from "../shared/lib/format";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type {
  EmployeeWorkspaceData,
  EmployeeWorkspacePerson,
} from "../shared/types/employeeWorkspace";
import {
  EmptyState,
  Input,
  LoadingState,
  Select,
  type SelectOption,
} from "../shared/ui";

type EmployeeWorkspaceSection = "enterprise" | "department" | "colleagues";

export function EmployeeWorkspacePage({
  section,
}: {
  section: EmployeeWorkspaceSection;
}): JSX.Element {
  const text = useAppText();
  const locale = useAppLocale();
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
              : text("Не удалось загрузить данные о вашей организации", "Failed to load your organization data"),
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
  }, [text]);

  const departmentOptions = useMemo<SelectOption[]>(() => {
    if (!workspace) return [{ value: "all", label: text("Все отделы", "All departments") }];
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
      { value: "all", label: text("Все отделы", "All departments") },
      ...Array.from(departments.entries())
        .sort((left, right) => left[1].localeCompare(right[1], locale))
        .map(([id, name]) => ({ value: String(id), label: name })),
    ];
  }, [locale, text, workspace]);

  const visibleColleagues = useMemo(() => {
    if (!workspace) return [];
    const query = search.trim().toLocaleLowerCase(locale);
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
        .some((value) =>
          String(value).toLocaleLowerCase(locale).includes(query),
        );
    });
  }, [departmentFilter, locale, search, workspace]);

  if (isLoading) {
    const labels: Record<EmployeeWorkspaceSection, string> = {
      enterprise: text("Загрузка предприятия...", "Loading enterprise..."),
      department: text("Загрузка отдела...", "Loading department..."),
      colleagues: text("Загрузка коллег...", "Loading colleagues..."),
    };
    return <LoadingState label={labels[section]} />;
  }

  if (!workspace) {
    return (
      <EmptyState
        title={text("Данные недоступны", "Data unavailable")}
        description={text("Не удалось получить информацию о вашей организации. Обратитесь к администратору.", "Unable to retrieve information about your organization. Contact an administrator.")}
      />
    );
  }

  const ownDepartmentColleagues = workspace.colleagues.filter(
    (person) =>
      workspace.self.departmentId !== null &&
      person.departmentId === workspace.self.departmentId,
  );
  const enterpriseDepartmentIds = new Set<number>();
  if (workspace.department) enterpriseDepartmentIds.add(workspace.department.id);
  workspace.colleagues.forEach((person) => {
    if (person.departmentId) enterpriseDepartmentIds.add(person.departmentId);
  });

  if (section === "enterprise") {
    return (
      <WorkspaceLayout>
        <WorkspaceHero
          compact
          eyebrow={text("Моё предприятие", "My enterprise")}
          icon={<FiLayers />}
          title={workspace.enterprise?.name ?? text("Предприятие не назначено", "Enterprise not assigned")}
          description={
            workspace.enterprise?.legalName ??
            text("Организационная привязка сотрудника к предприятию пока не настроена.", "The employee is not yet assigned to an enterprise.")
          }
        />

        <section className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
            <div>
              <div className="flex items-center gap-3">
                <span className="app-accent-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">
                  <FiLayers />
                </span>
                <h2 className="app-text text-base font-black">{text("Контакты предприятия", "Enterprise contacts")}</h2>
              </div>

              <div className="mt-4 grid gap-x-7 gap-y-4 sm:grid-cols-2">
                <CompactInfo label={text("Электронная почта", "Email")} value={workspace.enterprise?.email} />
                <CompactInfo label={text("Телефон", "Phone")} value={workspace.enterprise?.phone} />
                <CompactInfo label={text("Адрес", "Address")} value={workspace.enterprise?.address} wide />
              </div>
            </div>

            <div className="app-border-soft border-t pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <p className="app-muted text-[10px] font-black uppercase tracking-wide">
                {text("Руководитель предприятия", "Enterprise director")}
              </p>
              <LeaderSummary person={workspace.enterpriseLeader} text={text} />
            </div>
          </div>

          <div className="app-border-soft mt-5 grid gap-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <CompactInfo label={text("Мой отдел", "My department")} value={workspace.department?.name} />
            <CompactInfo label={text("Должность", "Position")} value={workspace.self.positionName} />
            <CompactInfo label={text("Коллеги", "Colleagues")} value={workspace.colleagues.length} />
            <CompactInfo label={text("Отделов", "Departments")} value={enterpriseDepartmentIds.size} />
          </div>
        </section>
      </WorkspaceLayout>
    );
  }

  if (section === "department") {
    return (
      <WorkspaceLayout>
        <WorkspaceHero
          eyebrow={text("Мой отдел", "My department")}
          icon={<FiBriefcase />}
          title={workspace.department?.name ?? text("Отдел не назначен", "Department not assigned")}
          description={
            workspace.self.positionName
              ? text(`Ваша должность: ${workspace.self.positionName}`, `Your position: ${workspace.self.positionName}`)
              : text("Должность сотрудника пока не указана.", "The employee position is not specified yet.")
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<FiUsers />}
            label={text("Коллег в отделе", "Department colleagues")}
            value={ownDepartmentColleagues.length}
          />
          <MetricCard
            icon={<FiUserCheck />}
            label={text("Начальник отдела", "Department head")}
            value={workspace.departmentLeader?.fullName ?? text("Не назначен", "Not assigned")}
          />
          <MetricCard
            icon={<FiBriefcase />}
            label={text("Моя должность", "My position")}
            value={workspace.self.positionName ?? text("Не указана", "Not specified")}
          />
          <MetricCard
            icon={<FiMapPin />}
            label={text("Рабочее место", "Workplace")}
            value={workspace.self.workplace ?? text("Не указано", "Not specified")}
          />
        </section>

        <section className="grid items-start gap-5 xl:grid-cols-2">
          <InfoPanel icon={<FiMapPin />} title={text("Информация об отделе", "Department information")}>
            <InfoRow label={text("Название", "Name")} value={workspace.department?.name} />
            <InfoRow label={text("Предприятие", "Enterprise")} value={workspace.enterprise?.name} />
            <InfoRow label={text("Электронная почта", "Email")} value={workspace.department?.email} />
            <InfoRow label={text("Телефон", "Phone")} value={workspace.department?.phone} />
            <InfoRow
              label={text("Расположение", "Location")}
              value={workspace.department?.location}
              wide
            />
          </InfoPanel>

          <section className="app-surface app-border overflow-hidden rounded-[28px] border">
            <SectionHeader
              description={text("Ваш непосредственный руководитель в организационной структуре.", "Your direct manager in the organization structure.")}
              icon={<FiUserCheck />}
              title={text("Начальник отдела", "Department head")}
            />
            <div className="p-5">
              <LeaderCard person={workspace.departmentLeader} text={text} />
            </div>
          </section>
        </section>

        <InfoPanel icon={<FiBriefcase />} title={text("Моя работа в отделе", "My work in the department")}>
          <InfoRow label={text("Должность", "Position")} value={workspace.self.positionName} />
          <InfoRow label={text("Рабочее место", "Workplace")} value={workspace.self.workplace} />
          <InfoRow
            label={text("Тип занятости", "Employment type")}
            value={employmentTypeLabel(workspace.self.employmentType, text)}
          />
          <InfoRow
            label={text("Дата начала работы", "Start date")}
            value={
              workspace.self.hireDate ? formatDate(workspace.self.hireDate, locale) : null
            }
          />
        </InfoPanel>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <WorkspaceHero
        eyebrow={text("Внутренний справочник", "Internal directory")}
        icon={<FiUsers />}
        title={text("Коллеги", "Colleagues")}
        description={text(`Активные сотрудники ${workspace.enterprise?.name ?? "вашего предприятия"}. По коллегам доступны только данные, необходимые для рабочей коммуникации.`, `Active employees of ${workspace.enterprise?.name ?? "your enterprise"}. Only information needed for work communication is shown for colleagues.`)}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={<FiUsers />}
          label={text("Всего коллег", "Total colleagues")}
          value={workspace.colleagues.length}
        />
        <MetricCard
          icon={<FiBriefcase />}
          label={text("В моём отделе", "In my department")}
          value={ownDepartmentColleagues.length}
        />
        <MetricCard
          icon={<FiLayers />}
          label={text("Отделов в справочнике", "Departments in directory")}
          value={enterpriseDepartmentIds.size}
        />
      </section>

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <SectionHeader
          description={text("Поиск по ФИО, рабочей почте, должности или отделу.", "Search by name, work email, position, or department.")}
          icon={<FiUsers />}
          title={text("Справочник коллег", "Colleague directory")}
        />

        <div className="app-border-soft flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative w-full sm:max-w-md">
            <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              className="pl-11"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={text("Поиск по ФИО, почте или должности", "Search by name, email, or position")}
              value={search}
            />
          </div>
          <Select
            ariaLabel={text("Фильтр по отделу", "Department filter")}
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
            <p className="app-text text-sm font-black">
              {text("Безопасный внутренний справочник", "Safe internal directory")}
            </p>
            <p className="app-muted mt-1 text-xs font-semibold leading-5">
              {text("Показываются только ФИО, рабочая почта, должность и отдел. Телефоны, зарплаты, адреса, документы и другие кадровые данные коллег не раскрываются.", "Only names, work email, position, and department are shown. Phone numbers, salaries, addresses, documents, and other HR data of colleagues are not disclosed.")}
            </p>
          </div>
        </div>

        {visibleColleagues.length ? (
          <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleColleagues.map((person) => (
              <ColleagueCard
                isOwnDepartment={
                  person.departmentId === workspace.self.departmentId
                }
                key={person.id}
                person={person}
                text={text}
              />
            ))}
          </div>
        ) : (
          <div className="app-muted p-10 text-center text-sm font-semibold">
            {text("По выбранным условиям коллеги не найдены.", "No colleagues match the selected filters.")}
          </div>
        )}
      </section>
    </WorkspaceLayout>
  );
}

function WorkspaceLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      initial={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function WorkspaceHero({
  compact = false,
  description,
  eyebrow,
  icon,
  title,
}: {
  compact?: boolean;
  description: string;
  eyebrow: string;
  icon: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <section
      className={[
        "app-accent-gradient-panel overflow-hidden border border-white/10 text-white",
        compact
          ? "rounded-[24px] p-5 shadow-lg sm:p-6"
          : "rounded-[30px] p-6 shadow-2xl sm:p-8",
      ].join(" ")}
    >
      <div className="flex items-center gap-4">
        <span
          className={[
            "flex shrink-0 items-center justify-center border border-white/20 bg-white/10 backdrop-blur",
            compact
              ? "h-12 w-12 rounded-xl text-xl"
              : "h-16 w-16 rounded-2xl text-2xl",
          ].join(" ")}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">
            {eyebrow}
          </p>
          <h1
            className={[
              "mt-1 break-words font-black",
              compact ? "text-2xl" : "text-2xl sm:text-3xl",
            ].join(" ")}
          >
            {title}
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm font-semibold leading-5 text-white/75">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}

function CompactInfo({
  label,
  value,
  wide = false,
}: {
  label: string;
  value?: ReactNode | null;
  wide?: boolean;
}): JSX.Element {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="app-muted text-[10px] font-black uppercase tracking-wide">
        {label}
      </p>
      <p className="app-text mt-1 break-words text-sm font-bold leading-5">
        {value || "—"}
      </p>
    </div>
  );
}

function LeaderSummary({
  person,
  text,
}: {
  person: EmployeeWorkspacePerson | null;
  text: (ru: string, en: string) => string;
}): JSX.Element {
  return (
    <div className="mt-3 flex items-start gap-3">
      <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-black">
        {person ? initials(person.fullName) : <FiUserCheck />}
      </span>
      <div className="min-w-0">
        <p className="app-text text-sm font-black">
          {person?.fullName ?? text("Не назначен", "Not assigned")}
        </p>
        {person?.positionName && (
          <p className="app-text-soft mt-1 text-xs font-bold">{person.positionName}</p>
        )}
        {person?.email && (
          <p className="app-accent-text mt-2 flex items-center gap-2 break-all text-xs font-bold">
            <FiMail className="h-3.5 w-3.5 shrink-0" /> {person.email}
          </p>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[24px] border p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="app-muted text-[10px] font-black uppercase tracking-wide">
            {label}
          </p>
          <p className="app-text mt-1 break-words text-lg font-black">{value}</p>
        </div>
      </div>
    </article>
  );
}

function InfoPanel({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <section className="app-surface app-border overflow-hidden rounded-[28px] border">
      <SectionHeader description="" icon={icon} title={title} />
      <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  wide = false,
}: {
  label: string;
  value?: ReactNode | null;
  wide?: boolean;
}): JSX.Element {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="app-muted text-[10px] font-black uppercase tracking-wide">
        {label}
      </p>
      <p className="app-text-soft mt-1.5 break-words text-sm font-bold leading-6">
        {value || "—"}
      </p>
    </div>
  );
}

function SectionHeader({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <div className="app-surface-muted app-border flex items-center gap-3 border-b px-5 py-4">
      <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
        {icon}
      </span>
      <div>
        <h2 className="app-text text-lg font-black">{title}</h2>
        {description && (
          <p className="app-muted mt-0.5 text-xs font-semibold leading-5">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function LeaderCard({
  person,
  text,
}: {
  person: EmployeeWorkspacePerson | null;
  text: (ru: string, en: string) => string;
}): JSX.Element {
  return (
    <article className="app-surface-muted app-border rounded-2xl border p-4">
      <div className="flex items-start gap-3">
        <span className="app-accent-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-sm font-black">
          {person ? initials(person.fullName) : <FiUserCheck />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="app-text text-sm font-black">
            {person?.fullName ?? text("Руководитель не назначен", "Leader not assigned")}
          </p>
          {person?.positionName && (
            <p className="app-text-soft mt-1 text-xs font-bold">
              {person.positionName}
            </p>
          )}
          {person?.departmentName && (
            <p className="app-muted mt-1 text-xs font-semibold">
              {person.departmentName}
            </p>
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
  text,
}: {
  isOwnDepartment: boolean;
  person: EmployeeWorkspacePerson;
  text: (ru: string, en: string) => string;
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
              <span className="app-accent-soft rounded-full border px-2.5 py-1 text-[10px] font-black">
                {text("Мой отдел", "My department")}
              </span>
            )}
          </div>
          <p className="app-text-soft mt-2 text-xs font-bold">
            {person.positionName ?? text("Должность не указана", "Position not specified")}
          </p>
          <p className="app-muted mt-1 text-xs font-semibold">
            {person.departmentName ?? text("Отдел не указан", "Department not specified")}
          </p>
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

function employmentTypeLabel(
  value: string | null,
  text: (ru: string, en: string) => string,
): string {
  const labels: Record<string, [string, string]> = {
    full_time: ["Полная занятость", "Full-time"],
    part_time: ["Частичная занятость", "Part-time"],
    temporary: ["Временная работа", "Temporary"],
    internship: ["Стажировка", "Internship"],
  };
  const label = value ? labels[value] : null;
  return label ? text(label[0], label[1]) : value || "—";
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
