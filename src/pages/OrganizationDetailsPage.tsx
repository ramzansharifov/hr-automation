import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  FiArrowLeft,
  FiBriefcase,
  FiChevronRight,
  FiHash,
  FiLayers,
  FiMail,
  FiMapPin,
  FiPhone,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { formatDate } from "../shared/lib/format";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type {
  HrEntityKey,
  HrFilterCondition,
  HrFilterValue,
  HrRecord,
} from "../shared/types/hr";
import {
  Button,
  Dialog,
  EmptyState,
  LoadingState,
  SearchableSelect,
  type SelectOption,
} from "../shared/ui";

type OrganizationDetailsMode = "enterprise" | "department";
type OrganizationFilters = Record<string, HrFilterValue | HrFilterCondition>;

export function OrganizationDetailsPage(): JSX.Element {
  const navigate = useNavigate();
  const params = useParams();
  const { hasPermission } = useAuth();
  const enterpriseId = positiveId(params.enterpriseId);
  const departmentId = positiveId(params.departmentId);
  const mode: OrganizationDetailsMode = departmentId ? "department" : "enterprise";
  const canViewEmployees = hasPermission("employees.view");
  const canAssignLeader = hasPermission("organization.assign_leader");

  const [enterprise, setEnterprise] = useState<HrRecord | null>(null);
  const [department, setDepartment] = useState<HrRecord | null>(null);
  const [departments, setDepartments] = useState<HrRecord[]>([]);
  const [positions, setPositions] = useState<HrRecord[]>([]);
  const [employees, setEmployees] = useState<HrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [isLeaderDialogOpen, setIsLeaderDialogOpen] = useState(false);
  const [leaderOptions, setLeaderOptions] = useState<SelectOption[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [leaderLoading, setLeaderLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadDetails(): Promise<void> {
      if (!enterpriseId || (mode === "department" && !departmentId)) {
        setHasError(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);
      try {
        const enterpriseRecord = await hrApiClient.getById({
          entity: "enterprises",
          id: enterpriseId,
        });
        if (!enterpriseRecord) throw new Error("Предприятие не найдено");

        const departmentRecord = departmentId
          ? await hrApiClient.getById({ entity: "departments", id: departmentId })
          : null;
        if (
          departmentId &&
          (!departmentRecord || Number(departmentRecord.enterprise_id) !== enterpriseId)
        ) {
          throw new Error("Отдел не найден в выбранном предприятии");
        }

        const departmentRows = departmentRecord
          ? [departmentRecord]
          : await loadAllRecords("departments", { enterprise_id: enterpriseId }, "name");
        const departmentIds = departmentRows
          .map((item) => positiveId(item.id))
          .filter((id): id is number => Boolean(id));

        const [positionRows, employeeRows] = await Promise.all([
          departmentIds.length
            ? loadAllRecords(
                "positions",
                {
                  department_id: {
                    operator: "in",
                    value: departmentIds,
                  },
                },
                "name",
              )
            : Promise.resolve([]),
          canViewEmployees && departmentIds.length
            ? loadAllRecords(
                "employees",
                {
                  department_id: {
                    operator: "in",
                    value: departmentIds,
                  },
                },
                "last_name",
              )
            : Promise.resolve([]),
        ]);

        if (!isActive) return;
        setEnterprise(enterpriseRecord);
        setDepartment(departmentRecord);
        setDepartments(departmentRows);
        setPositions(positionRows);
        setEmployees(employeeRows);
      } catch (error) {
        if (!isActive) return;
        setHasError(true);
        toast.error(errorMessage(error, "Не удалось загрузить данные организации"));
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadDetails();
    return () => {
      isActive = false;
    };
  }, [canViewEmployees, departmentId, enterpriseId, mode, refreshIndex]);

  const employeeCountByDepartment = useMemo(
    () => countById(employees, "department_id"),
    [employees],
  );
  const positionCountByDepartment = useMemo(
    () => countById(positions, "department_id"),
    [positions],
  );
  const employeeCountByPosition = useMemo(
    () => countById(employees, "position_id"),
    [employees],
  );

  async function openLeaderDialog(): Promise<void> {
    if (!canAssignLeader || !enterpriseId) return;

    const targetDepartmentIds =
      mode === "department"
        ? departmentId
          ? [departmentId]
          : []
        : departments
            .map((item) => positiveId(item.id))
            .filter((id): id is number => Boolean(id));

    setIsLeaderDialogOpen(true);
    setLeaderLoading(true);
    setLeaderOptions([]);
    setLeaderId("");

    try {
      const candidates = targetDepartmentIds.length
        ? await loadAllRecords(
            "employees",
            {
              department_id: {
                operator: "in",
                value: targetDepartmentIds,
              },
              position_id: { operator: "is_null", value: true },
              status: "active",
            },
            "last_name",
          )
        : [];

      const options = candidates.map((employee) => ({
        value: String(employee.id),
        label: employeeName(employee),
      }));
      const currentLeaderId =
        mode === "enterprise"
          ? positiveId(enterprise?.general_director_employee_id)
          : positiveId(department?.director_employee_id);
      const currentValue = currentLeaderId ? String(currentLeaderId) : "";

      setLeaderOptions(options);
      setLeaderId(
        currentValue && options.some((option) => option.value === currentValue)
          ? currentValue
          : "",
      );
    } catch (error) {
      setIsLeaderDialogOpen(false);
      toast.error(errorMessage(error, "Не удалось загрузить сотрудников для назначения"));
    } finally {
      setLeaderLoading(false);
    }
  }

  async function saveLeader(): Promise<void> {
    if (!canAssignLeader || !enterpriseId) return;
    if (mode === "department" && !departmentId) return;

    setLeaderLoading(true);
    try {
      if (mode === "enterprise") {
        await hrApiClient.update({
          entity: "enterprises",
          id: enterpriseId,
          data: {
            general_director_employee_id: leaderId ? Number(leaderId) : null,
          },
        });
      } else {
        await hrApiClient.update({
          entity: "departments",
          id: departmentId!,
          data: {
            director_employee_id: leaderId ? Number(leaderId) : null,
          },
        });
      }

      toast.success(
        leaderId ? "Руководитель назначен" : "Руководитель снят с назначения",
      );
      setIsLeaderDialogOpen(false);
      setRefreshIndex((value) => value + 1);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось сохранить назначение руководителя"));
    } finally {
      setLeaderLoading(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Загрузка карточки организации..." />;
  }

  if (hasError || !enterprise || (mode === "department" && !department)) {
    return (
      <EmptyState
        description="Вернитесь к организационной структуре и выберите существующую запись."
        title={mode === "enterprise" ? "Предприятие не найдено" : "Отдел не найден"}
      />
    );
  }

  const record = mode === "enterprise" ? enterprise : department!;
  const title = recordName(record);
  const subtitle =
    mode === "enterprise"
      ? displayValue(enterprise.legal_name)
      : `Предприятие: ${recordName(enterprise)}`;
  const activeEmployees = employees.filter(
    (employee) => String(employee.status) === "active",
  );
  const unassignedEmployees = employees.filter(
    (employee) => !positiveId(employee.position_id),
  );
  const leaderEmployeeId =
    mode === "enterprise"
      ? positiveId(enterprise.general_director_employee_id)
      : positiveId(department!.director_employee_id);
  const leaderName =
    mode === "enterprise"
      ? displayValue(enterprise.general_director_name)
      : displayValue(department!.director_name);
  const backPath =
    mode === "enterprise"
      ? "/enterprises"
      : `/enterprises/${enterpriseId}/departments`;
  const structurePath =
    mode === "enterprise"
      ? `/enterprises/${enterpriseId}/departments`
      : `/enterprises/${enterpriseId}/departments/${departmentId}/positions`;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      initial={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      <section className="app-accent-gradient-panel overflow-hidden rounded-[30px] border border-white/10 p-6 text-white shadow-2xl sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xl font-black shadow-lg backdrop-blur">
              {initials(title)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
                {mode === "enterprise" ? "Карточка предприятия" : "Карточка отдела"}
              </p>
              <h1 className="mt-1 truncate text-2xl font-black sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold text-white/75">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="border-white/20 bg-white/10 text-white hover:bg-white/15"
              leftIcon={<FiArrowLeft className="h-4 w-4" />}
              onClick={() => navigate(backPath)}
              variant="ghost"
            >
              Назад
            </Button>
            {mode === "department" && (
              <Button
                className="border-white/20 bg-white/10 text-white hover:bg-white/15"
                onClick={() => navigate(`/enterprises/${enterpriseId}`)}
                variant="ghost"
              >
                Предприятие
              </Button>
            )}
            <Button
              className="border-white/20 shadow-lg"
              onClick={() => navigate(structurePath)}
              style={{ background: "#ffffff", color: "#0f172a" }}
              variant="ghost"
            >
              {mode === "enterprise" ? "Открыть отделы" : "Открыть должности"}
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {mode === "enterprise" ? (
          <>
            <MetricCard icon={<FiLayers />} label="Отделов" value={departments.length} />
            <MetricCard
              icon={<FiUsers />}
              label="Сотрудников"
              value={canViewEmployees ? employees.length : "—"}
            />
            <MetricCard icon={<FiBriefcase />} label="Должностей" value={positions.length} />
            <MetricCard
              icon={<FiUserCheck />}
              label="Активных сотрудников"
              value={canViewEmployees ? activeEmployees.length : "—"}
            />
          </>
        ) : (
          <>
            <MetricCard
              icon={<FiUsers />}
              label="Сотрудников"
              value={canViewEmployees ? employees.length : "—"}
            />
            <MetricCard icon={<FiBriefcase />} label="Должностей" value={positions.length} />
            <MetricCard
              icon={<FiUserCheck />}
              label="Активных"
              value={canViewEmployees ? activeEmployees.length : "—"}
            />
            <MetricCard
              icon={<FiHash />}
              label="Без должности"
              value={canViewEmployees ? unassignedEmployees.length : "—"}
            />
          </>
        )}
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        {mode === "enterprise" ? (
          <InfoPanel icon={<FiBriefcase />} title="Основная информация">
            <InfoRow label="Категория" value={displayValue(enterprise.legal_form)} />
            <InfoRow
              label="Юридическое название"
              value={displayValue(enterprise.legal_name)}
            />
            <InfoRow
              label="Регистрационный номер"
              value={displayValue(enterprise.registration_number)}
            />
            <InfoRow label="Адрес" value={displayValue(enterprise.address)} wide />
          </InfoPanel>
        ) : (
          <InfoPanel icon={<FiLayers />} title="Информация об отделе">
            <InfoRow label="Предприятие" value={recordName(enterprise)} />
            <InfoRow label="Расположение" value={displayValue(department!.location)} />
            <InfoRow
              label="Дата создания"
              value={department!.created_on ? formatDate(department!.created_on) : "—"}
            />
            <InfoRow label="Название" value={recordName(department!)} />
          </InfoPanel>
        )}

        <div className="space-y-5">
          <ContactCard record={record} />
          <LeaderCard
            canManage={canAssignLeader}
            canViewEmployee={canViewEmployees}
            employeeId={leaderEmployeeId}
            leaderName={leaderName}
            onManage={() => void openLeaderDialog()}
            title={
              mode === "enterprise"
                ? "Руководитель предприятия"
                : "Руководитель отдела"
            }
          />
        </div>
      </section>

      {mode === "enterprise" ? (
        <section className="app-surface app-border overflow-hidden rounded-[28px] border">
          <SectionHeader
            description="Подразделения предприятия, руководители и численность."
            icon={<FiLayers />}
            title="Отделы"
          />
          {departments.length ? (
            <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
              {departments.map((item) => {
                const id = positiveId(item.id);
                return (
                  <Link
                    className="app-surface-muted app-border group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-[var(--accent-border)] hover:shadow-lg"
                    key={String(item.id)}
                    to={`/enterprises/${enterpriseId}/departments/${id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="app-text truncate font-black">{recordName(item)}</p>
                        <p className="app-muted mt-1 truncate text-xs font-semibold">
                          {displayValue(item.director_name) === "—"
                            ? "Руководитель не назначен"
                            : `Руководитель: ${displayValue(item.director_name)}`}
                        </p>
                      </div>
                      <FiChevronRight className="app-muted mt-1 h-5 w-5 shrink-0 transition group-hover:translate-x-1 group-hover:text-[var(--accent)]" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <MiniBadge
                        label="Сотрудников"
                        value={
                          canViewEmployees
                            ? employeeCountByDepartment.get(id ?? -1) ?? 0
                            : "—"
                        }
                      />
                      <MiniBadge
                        label="Должностей"
                        value={positionCountByDepartment.get(id ?? -1) ?? 0}
                      />
                      {item.location && (
                        <MiniBadge label="Локация" value={String(item.location)} />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptySection text="В предприятии пока нет отделов." />
          )}
        </section>
      ) : (
        <section className="app-surface app-border overflow-hidden rounded-[28px] border">
          <SectionHeader
            description="Должности отдела и количество назначенных сотрудников."
            icon={<FiBriefcase />}
            title="Должности"
          />
          {positions.length ? (
            <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
              {positions.map((position) => {
                const id = positiveId(position.id);
                return (
                  <article
                    className="app-surface-muted app-border rounded-2xl border p-4"
                    key={String(position.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="app-text font-black">{recordName(position)}</p>
                        <p className="app-muted mt-2 line-clamp-2 text-xs font-semibold leading-5">
                          {displayValue(position.responsibilities) === "—"
                            ? "Обязанности не указаны"
                            : String(position.responsibilities)}
                        </p>
                      </div>
                      <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                        <FiBriefcase />
                      </span>
                    </div>
                    <div className="mt-4">
                      <MiniBadge
                        label="Сотрудников"
                        value={
                          canViewEmployees
                            ? employeeCountByPosition.get(id ?? -1) ?? 0
                            : "—"
                        }
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptySection text="В отделе пока нет должностей." />
          )}
        </section>
      )}

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <SectionHeader
          description={
            canViewEmployees
              ? mode === "enterprise"
                ? "Сотрудники всех отделов предприятия."
                : "Сотрудники выбранного отдела."
              : "Для просмотра кадрового состава требуется разрешение на просмотр сотрудников."
          }
          icon={<FiUsers />}
          title="Сотрудники"
        />
        {canViewEmployees ? (
          employees.length ? (
            <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2 xl:grid-cols-3">
              {employees.slice(0, 12).map((employee) => (
                <EmployeeCard employee={employee} key={String(employee.id)} />
              ))}
              {employees.length > 12 && (
                <div className="app-muted col-span-full px-1 pt-2 text-xs font-semibold">
                  Показаны первые 12 сотрудников из {employees.length}.
                </div>
              )}
            </div>
          ) : (
            <EmptySection text="Сотрудники пока не добавлены." />
          )
        ) : (
          <EmptySection text="У текущей роли нет разрешения employees.view." />
        )}
      </section>

      <Dialog
        description={
          mode === "enterprise"
            ? "Выберите активного сотрудника этого предприятия без назначенной должности. При наличии учётной записи ему автоматически будет выдана системная роль руководителя предприятия."
            : "Выберите активного сотрудника этого отдела без назначенной должности. При наличии учётной записи ему автоматически будет выдана системная роль руководителя отдела."
        }
        onOpenChange={(open) => {
          setIsLeaderDialogOpen(open);
          if (!open) {
            setLeaderId("");
            setLeaderOptions([]);
          }
        }}
        open={isLeaderDialogOpen}
        title={
          mode === "enterprise"
            ? "Назначить руководителя предприятия"
            : "Назначить руководителя отдела"
        }
      >
        {leaderLoading && leaderOptions.length === 0 ? (
          <LoadingState label="Загрузка сотрудников..." />
        ) : (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <span className="app-text text-sm font-black">Сотрудник</span>
              <SearchableSelect
                allowEmpty
                ariaLabel="Сотрудник"
                emptyOptionLabel="Не назначен"
                noOptionsLabel="Свободные сотрудники не найдены"
                onValueChange={setLeaderId}
                options={leaderOptions}
                placeholder="Выберите сотрудника"
                searchPlaceholder="Поиск по фамилии или имени"
                value={leaderId}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setIsLeaderDialogOpen(false)}
                type="button"
                variant="secondary"
              >
                Отмена
              </Button>
              <Button disabled={leaderLoading} onClick={() => void saveLeader()}>
                Сохранить назначение
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </motion.div>
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
      <div className="flex items-center gap-3">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg">
          {icon}
        </span>
        <div>
          <p className="app-muted text-[11px] font-black uppercase tracking-wide">{label}</p>
          <p className="app-text mt-1 text-2xl font-black">{value}</p>
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
      <div className="app-surface-muted app-border flex items-center gap-3 border-b px-5 py-4">
        <span className="app-accent-soft flex h-10 w-10 items-center justify-center rounded-xl border">
          {icon}
        </span>
        <h2 className="app-text text-lg font-black">{title}</h2>
      </div>
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
  value: ReactNode;
  wide?: boolean;
}): JSX.Element {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="app-muted text-[11px] font-black uppercase tracking-wide">{label}</p>
      <div className="app-text-soft mt-1.5 break-words text-sm font-bold leading-6">
        {value}
      </div>
    </div>
  );
}

function ContactCard({ record }: { record: HrRecord }): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[24px] border p-5">
      <p className="app-muted text-[11px] font-black uppercase tracking-wide">Контакты</p>
      <div className="mt-4 space-y-3">
        <ContactRow
          icon={<FiPhone />}
          label="Телефон"
          value={displayValue(record.phone)}
        />
        <ContactRow
          icon={<FiMail />}
          label="Email"
          value={displayValue(record.email)}
        />
        {record.location && (
          <ContactRow
            icon={<FiMapPin />}
            label="Расположение"
            value={String(record.location)}
          />
        )}
      </div>
    </article>
  );
}

function ContactRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <span className="app-accent-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="app-muted text-[10px] font-black uppercase tracking-wide">{label}</p>
        <p className="app-text-soft mt-1 break-all text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function LeaderCard({
  canManage,
  canViewEmployee,
  employeeId,
  leaderName,
  onManage,
  title,
}: {
  canManage: boolean;
  canViewEmployee: boolean;
  employeeId: number | null;
  leaderName: string;
  onManage: () => void;
  title: string;
}): JSX.Element {
  const hasLeader = leaderName !== "—";

  return (
    <article className="app-surface app-border rounded-[24px] border p-5">
      <div className="flex items-start gap-3">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg">
          <FiUserCheck />
        </span>
        <div className="min-w-0 flex-1">
          <p className="app-muted text-[10px] font-black uppercase tracking-wide">{title}</p>
          {canViewEmployee && employeeId ? (
            <Link
              className="app-text mt-1 inline-flex min-w-0 items-center gap-1 text-sm font-black transition hover:text-[var(--accent)]"
              to={`/employees/${employeeId}`}
            >
              <span className="truncate">{hasLeader ? leaderName : "Не назначен"}</span>
              <FiChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          ) : (
            <p className="app-text mt-1 truncate text-sm font-black">
              {hasLeader ? leaderName : "Не назначен"}
            </p>
          )}
        </div>
        {canManage && (
          <Button onClick={onManage} size="sm" type="button" variant="secondary">
            {hasLeader ? "Изменить" : "Назначить"}
          </Button>
        )}
      </div>
      {canManage && (
        <p className="app-muted mt-4 text-xs font-semibold leading-5">
          Руководитель назначается здесь, в карточке организации. В списке доступны
          только активные сотрудники без текущей должности.
        </p>
      )}
    </article>
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
        <p className="app-muted mt-0.5 text-xs font-semibold">{description}</p>
      </div>
    </div>
  );
}

function MiniBadge({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <span className="app-surface app-border rounded-full border px-3 py-1.5 text-[11px] font-bold">
      <span className="app-muted">{label}: </span>
      <span className="app-text">{value}</span>
    </span>
  );
}

function EmployeeCard({ employee }: { employee: HrRecord }): JSX.Element {
  const id = positiveId(employee.id);
  const name = employeeName(employee);
  const status = String(employee.status ?? "active");
  const content = (
    <div className="flex items-start gap-3">
      <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xs font-black">
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="app-text truncate font-black">{name}</p>
          <StatusBadge status={status} />
        </div>
        <p className="app-muted mt-1 truncate text-xs font-semibold">
          {[employee.department_name, employee.position_name]
            .map((value) => String(value ?? "").trim())
            .filter(Boolean)
            .join(" · ") || "Должность не назначена"}
        </p>
      </div>
    </div>
  );

  return id ? (
    <Link
      className="app-surface-muted app-border rounded-2xl border p-4 transition hover:border-[var(--accent-border)] hover:shadow-lg"
      to={`/employees/${id}`}
    >
      {content}
    </Link>
  ) : (
    <article className="app-surface-muted app-border rounded-2xl border p-4">
      {content}
    </article>
  );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const active = status === "active";
  return (
    <span
      className={[
        "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black",
        active
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600"
          : "app-surface app-border app-text-soft",
      ].join(" ")}
    >
      {active ? "Активен" : status === "terminated" ? "Уволен" : status}
    </span>
  );
}

function EmptySection({ text }: { text: string }): JSX.Element {
  return <div className="app-muted p-8 text-center text-sm font-semibold">{text}</div>;
}

async function loadAllRecords(
  entity: HrEntityKey,
  filters: OrganizationFilters | undefined,
  orderBy: string,
): Promise<HrRecord[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await hrApiClient.list({
      entity,
      filters,
      orderBy,
      orderDirection: "asc",
      page,
      pageSize: 100,
    });
    records.push(...result.items);
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);

  return records;
}

function countById(records: HrRecord[], key: string): Map<number, number> {
  const result = new Map<number, number>();
  records.forEach((record) => {
    const id = positiveId(record[key]);
    if (!id) return;
    result.set(id, (result.get(id) ?? 0) + 1);
  });
  return result;
}

function recordName(record: HrRecord): string {
  return String(record.name ?? record.title ?? "—");
}

function employeeName(record: HrRecord): string {
  return (
    [record.last_name, record.first_name, record.middle_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ") || "Сотрудник"
  );
}

function displayValue(value: unknown): string {
  const normalized = String(value ?? "").trim();
  return normalized || "—";
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

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
