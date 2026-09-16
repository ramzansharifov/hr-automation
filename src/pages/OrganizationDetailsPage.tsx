import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  FiBriefcase,
  FiChevronRight,
  FiLayers,
  FiMail,
  FiPhone,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { HrEntityDeleteDialog } from "../features/hr-entities/components/HrEntityDeleteDialog";
import { HrEntityDialog } from "../features/hr-entities/components/HrEntityDialog";
import { DepartmentLeaderDialog } from "../features/organization/DepartmentLeaderDialog";
import { useAppLocale, useAppText } from "../shared/i18n";
import { formatDate } from "../shared/lib/format";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type {
  HrEntityKey,
  HrFilterCondition,
  HrFilterValue,
  HrRecord,
} from "../shared/types/hr";
import {
  ActionButton,
  EmptyState,
  LoadingState,
  RecordActions,
} from "../shared/ui";

type OrganizationDetailsMode = "enterprise" | "department";
type OrganizationFilters = Record<string, HrFilterValue | HrFilterCondition>;

export function OrganizationDetailsPage(): JSX.Element {
  const text = useAppText();
  const locale = useAppLocale();
  const navigate = useNavigate();
  const params = useParams();
  const { hasPermission } = useAuth();
  const enterpriseId = positiveId(params.enterpriseId);
  const departmentId = positiveId(params.departmentId);
  const mode: OrganizationDetailsMode = departmentId ? "department" : "enterprise";

  const canViewEmployees = hasPermission("employees.view");
  const canViewDepartments = hasPermission("departments.view");
  const canViewPositions = hasPermission("positions.view");
  const canAssignLeader = hasPermission(
    mode === "enterprise"
      ? "enterprises.assign_leader"
      : "departments.assign_leader",
  );
  const canCreateDepartment = hasPermission("departments.create");
  const canEditDepartment = hasPermission("departments.edit");
  const canDeleteDepartment = hasPermission("departments.delete");
  const canCreatePosition = hasPermission("positions.create");
  const canEditPosition = hasPermission("positions.edit");
  const canDeletePosition = hasPermission("positions.delete");

  const [enterprise, setEnterprise] = useState<HrRecord | null>(null);
  const [department, setDepartment] = useState<HrRecord | null>(null);
  const [departments, setDepartments] = useState<HrRecord[]>([]);
  const [positions, setPositions] = useState<HrRecord[]>([]);
  const [employees, setEmployees] = useState<HrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [isLeaderDialogOpen, setIsLeaderDialogOpen] = useState(false);
  const [departmentDialogMode, setDepartmentDialogMode] = useState<"create" | "edit">("create");
  const [editingDepartment, setEditingDepartment] = useState<HrRecord | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<HrRecord | null>(null);
  const [isDepartmentFormOpen, setIsDepartmentFormOpen] = useState(false);
  const [isDepartmentDeleteOpen, setIsDepartmentDeleteOpen] = useState(false);
  const [positionDialogMode, setPositionDialogMode] = useState<"create" | "edit">("create");
  const [editingPosition, setEditingPosition] = useState<HrRecord | null>(null);
  const [deletingPosition, setDeletingPosition] = useState<HrRecord | null>(null);
  const [isPositionFormOpen, setIsPositionFormOpen] = useState(false);
  const [isPositionDeleteOpen, setIsPositionDeleteOpen] = useState(false);

  useEffect(() => {
    let active = true;

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
        if (!enterpriseRecord) throw new Error(text("Предприятие не найдено", "Enterprise not found"));

        const departmentRecord = departmentId
          ? await hrApiClient.getById({ entity: "departments", id: departmentId })
          : null;
        if (
          departmentId &&
          (!departmentRecord || Number(departmentRecord.enterprise_id) !== enterpriseId)
        ) {
          throw new Error(text("Отдел не найден в выбранном предприятии", "Department not found in the selected enterprise"));
        }

        let departmentRows: HrRecord[] = [];
        if (departmentRecord) {
          departmentRows = [departmentRecord];
        } else if (canViewDepartments) {
          departmentRows = await loadAllRecords(
            "departments",
            { enterprise_id: enterpriseId },
            "name",
          );
        }

        const departmentIds = departmentRows
          .map((item) => positiveId(item.id))
          .filter((id): id is number => Boolean(id));

        const [positionRows, employeeRows] = await Promise.all([
          canViewPositions && departmentIds.length
            ? loadAllRecords(
                "positions",
                { department_id: { operator: "in", value: departmentIds } },
                "name",
              )
            : Promise.resolve([]),
          canViewEmployees && departmentIds.length
            ? loadAllRecords(
                "employees",
                { department_id: { operator: "in", value: departmentIds } },
                "last_name",
              )
            : Promise.resolve([]),
        ]);

        if (!active) return;
        setEnterprise(enterpriseRecord);
        setDepartment(departmentRecord);
        setDepartments(departmentRows);
        setPositions(positionRows);
        setEmployees(employeeRows);
      } catch (error) {
        if (!active) return;
        setHasError(true);
        toast.error(errorMessage(error, text("Не удалось загрузить данные организации", "Failed to load organization data")));
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadDetails();
    return () => {
      active = false;
    };
  }, [
    canViewDepartments,
    canViewEmployees,
    canViewPositions,
    departmentId,
    enterpriseId,
    mode,
    refreshIndex,
    text,
  ]);

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

  function openCreateDepartment(): void {
    if (!canCreateDepartment || !enterpriseId || mode !== "enterprise") return;
    setDepartmentDialogMode("create");
    setEditingDepartment(null);
    setIsDepartmentFormOpen(true);
  }

  function openEditDepartment(item: HrRecord): void {
    if (!canEditDepartment || mode !== "enterprise") return;
    setDepartmentDialogMode("edit");
    setEditingDepartment(item);
    setIsDepartmentFormOpen(true);
  }

  function openDeleteDepartment(item: HrRecord): void {
    if (!canDeleteDepartment || mode !== "enterprise") return;
    setDeletingDepartment(item);
    setIsDepartmentDeleteOpen(true);
  }

  async function saveDepartment(data: HrRecord): Promise<void> {
    if (!enterpriseId) throw new Error(text("Предприятие не найдено", "Enterprise not found"));
    if (departmentDialogMode === "create") {
      if (!canCreateDepartment) throw new Error(text("Недостаточно прав для создания отдела", "Insufficient permission to create a department"));
      await hrApiClient.create({
        entity: "departments",
        data: { ...data, enterprise_id: enterpriseId },
      });
    } else {
      if (!canEditDepartment) throw new Error(text("Недостаточно прав для изменения отдела", "Insufficient permission to edit a department"));
      const id = positiveId(editingDepartment?.id);
      if (!id) throw new Error(text("Отдел не найден", "Department not found"));
      await hrApiClient.update({
        entity: "departments",
        id,
        data: { ...data, enterprise_id: enterpriseId },
      });
    }
    setRefreshIndex((value) => value + 1);
  }

  async function deleteDepartment(): Promise<void> {
    if (!canDeleteDepartment) throw new Error(text("Недостаточно прав для удаления отдела", "Insufficient permission to delete a department"));
    const id = positiveId(deletingDepartment?.id);
    if (!id) throw new Error(text("Отдел не найден", "Department not found"));
    await hrApiClient.delete({ entity: "departments", id });
    setDeletingDepartment(null);
    setRefreshIndex((value) => value + 1);
  }

  function openCreatePosition(): void {
    if (!canCreatePosition || !departmentId) return;
    setPositionDialogMode("create");
    setEditingPosition(null);
    setIsPositionFormOpen(true);
  }

  function openEditPosition(item: HrRecord): void {
    if (!canEditPosition) return;
    setPositionDialogMode("edit");
    setEditingPosition(item);
    setIsPositionFormOpen(true);
  }

  function openDeletePosition(item: HrRecord): void {
    if (!canDeletePosition) return;
    setDeletingPosition(item);
    setIsPositionDeleteOpen(true);
  }

  async function savePosition(data: HrRecord): Promise<void> {
    if (!departmentId) throw new Error(text("Отдел не найден", "Department not found"));
    if (positionDialogMode === "create") {
      if (!canCreatePosition) throw new Error(text("Недостаточно прав для создания должности", "Insufficient permission to create a position"));
      await hrApiClient.create({
        entity: "positions",
        data: { ...data, department_id: departmentId },
      });
    } else {
      if (!canEditPosition) throw new Error(text("Недостаточно прав для изменения должности", "Insufficient permission to edit a position"));
      const id = positiveId(editingPosition?.id);
      if (!id) throw new Error(text("Должность не найдена", "Position not found"));
      await hrApiClient.update({
        entity: "positions",
        id,
        data: { ...data, department_id: departmentId },
      });
    }
    setRefreshIndex((value) => value + 1);
  }

  async function deletePosition(): Promise<void> {
    if (!canDeletePosition) throw new Error(text("Недостаточно прав для удаления должности", "Insufficient permission to delete a position"));
    const id = positiveId(deletingPosition?.id);
    if (!id) throw new Error(text("Должность не найдена", "Position not found"));
    await hrApiClient.delete({ entity: "positions", id });
    setDeletingPosition(null);
    setRefreshIndex((value) => value + 1);
  }

  if (isLoading) return <LoadingState label={text("Загрузка карточки организации...", "Loading organization profile...")} />;

  if (hasError || !enterprise || (mode === "department" && !department)) {
    return (
      <EmptyState
        description={text("Вернитесь к организационной структуре и выберите существующую запись.", "Return to the organization structure and select an existing record.")}
        title={mode === "enterprise" ? text("Предприятие не найдено", "Enterprise not found") : text("Отдел не найден", "Department not found")}
      />
    );
  }

  const record = mode === "enterprise" ? enterprise : department!;
  const title = recordName(record, text);
  const activeEmployees = employees.filter((item) => String(item.status) === "active");
  const leaderEmployeeId =
    mode === "enterprise"
      ? positiveId(enterprise.general_director_employee_id)
      : positiveId(department!.director_employee_id);
  const leaderName =
    mode === "enterprise"
      ? displayValue(enterprise.general_director_name)
      : displayValue(department!.director_name);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      initial={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      <section className="app-accent-gradient-panel overflow-hidden rounded-[30px] border border-white/10 p-6 text-white shadow-2xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
              {mode === "enterprise" ? text("Карточка предприятия", "Enterprise profile") : text("Карточка отдела", "Department profile")}
            </p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm font-semibold text-white/75">
              {mode === "enterprise"
                ? displayValue(enterprise.legal_name)
                : text(`Предприятие: ${recordName(enterprise, text)}`, `Enterprise: ${recordName(enterprise, text)}`)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              action="back"
              context="inverse"
              onClick={() =>
                navigate(
                  mode === "enterprise"
                    ? "/enterprises"
                    : `/enterprises/${enterpriseId}/departments`,
                )
              }
            />
            {mode === "enterprise" && canViewDepartments && (
              <ActionButton
                action="open"
                context="inverse"
                onClick={() => navigate(`/enterprises/${enterpriseId}/departments`)}
              >
                {text("Открыть отделы", "Open departments")}
              </ActionButton>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<FiLayers />}
          label={text("Отделов", "Departments")}
          value={canViewDepartments ? departments.length : "—"}
        />
        <MetricCard
          icon={<FiBriefcase />}
          label={text("Должностей", "Positions")}
          value={canViewPositions ? positions.length : "—"}
        />
        <MetricCard
          icon={<FiUsers />}
          label={text("Сотрудников", "Employees")}
          value={canViewEmployees ? employees.length : "—"}
        />
        <MetricCard
          icon={<FiUserCheck />}
          label={text("Активных сотрудников", "Active employees")}
          value={canViewEmployees ? activeEmployees.length : "—"}
        />
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <InfoPanel
          icon={mode === "enterprise" ? <FiBriefcase /> : <FiLayers />}
          title={mode === "enterprise" ? text("Основная информация", "Main information") : text("Информация об отделе", "Department information")}
        >
          {mode === "enterprise" ? (
            <>
              <InfoRow label={text("Юридическое название", "Legal name")} value={displayValue(enterprise.legal_name)} />
              <InfoRow label={text("Форма", "Legal form")} value={displayValue(enterprise.legal_form)} />
              <InfoRow label={text("Регистрационный номер", "Registration number")} value={displayValue(enterprise.registration_number)} />
              <InfoRow label={text("Адрес", "Address")} value={displayValue(enterprise.address)} />
            </>
          ) : (
            <>
              <InfoRow label={text("Предприятие", "Enterprise")} value={recordName(enterprise, text)} />
              <InfoRow label={text("Расположение", "Location")} value={displayValue(department!.location)} />
              <InfoRow
                label={text("Дата создания", "Creation date")}
                value={department!.created_on ? formatDate(department!.created_on, locale) : "—"}
              />
              <InfoRow label={text("Название", "Name")} value={recordName(department!, text)} />
            </>
          )}
        </InfoPanel>

        <div className="space-y-5">
          <ContactCard record={record} text={text} />
          <LeaderCard
            canManage={canAssignLeader}
            canViewEmployee={canViewEmployees}
            employeeId={leaderEmployeeId}
            leaderName={leaderName}
            onManage={() => setIsLeaderDialogOpen(true)}
            title={mode === "enterprise" ? text("Руководитель предприятия", "Enterprise director") : text("Руководитель отдела", "Department head")}
            text={text}
          />
        </div>
      </section>

      {mode === "enterprise" && (
        <section className="app-surface app-border overflow-hidden rounded-[28px] border">
          <SectionHeader
            actions={
              canCreateDepartment ? (
                <ActionButton
                  action="create"
                  onClick={openCreateDepartment}
                  size="sm"
                >
                  {text("Добавить отдел", "Add department")}
                </ActionButton>
              ) : undefined
            }
            icon={<FiLayers />}
            title={text("Отделы", "Departments")}
          />
          {!canViewDepartments ? (
            <EmptySection text={text("Нет доступа к просмотру отделов.", "No permission to view departments.")} />
          ) : departments.length === 0 ? (
            <EmptySection text={text("В предприятии пока нет отделов.", "There are no departments in this enterprise yet.")} />
          ) : (
            <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
              {departments.map((item) => {
                const id = positiveId(item.id);
                return (
                  <article className="app-surface-muted app-border rounded-2xl border p-4" key={String(item.id)}>
                    <div className="flex items-start justify-between gap-4">
                      <Link className="group min-w-0 flex-1" to={`/enterprises/${enterpriseId}/departments/${id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="app-text truncate font-black">{recordName(item, text)}</p>
                            <p className="app-muted mt-1 truncate text-xs font-semibold">
                              {displayValue(item.director_name) === "—"
                                ? text("Руководитель не назначен", "Leader not assigned")
                                : text(`Руководитель: ${displayValue(item.director_name)}`, `Leader: ${displayValue(item.director_name)}`)}
                            </p>
                          </div>
                          <FiChevronRight className="app-muted h-5 w-5 shrink-0" />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <MiniBadge label={text("Сотрудников", "Employees")} value={canViewEmployees ? employeeCountByDepartment.get(id ?? -1) ?? 0 : "—"} />
                          <MiniBadge label={text("Должностей", "Positions")} value={canViewPositions ? positionCountByDepartment.get(id ?? -1) ?? 0 : "—"} />
                        </div>
                      </Link>
                      {(canEditDepartment || canDeleteDepartment) && (
                        <RecordActions
                          className="shrink-0"
                          deleteLabel={text("Удалить отдел", "Delete department")}
                          editLabel={text("Редактировать отдел", "Edit department")}
                          onDelete={
                            canDeleteDepartment
                              ? () => openDeleteDepartment(item)
                              : undefined
                          }
                          onEdit={
                            canEditDepartment
                              ? () => openEditDepartment(item)
                              : undefined
                          }
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {mode === "department" && (
        <section className="app-surface app-border overflow-hidden rounded-[28px] border">
          <SectionHeader
            actions={
              canCreatePosition ? (
                <ActionButton
                  action="create"
                  onClick={openCreatePosition}
                  size="sm"
                >
                  {text("Добавить должность", "Add position")}
                </ActionButton>
              ) : undefined
            }
            icon={<FiBriefcase />}
            title={text("Должности", "Positions")}
          />
          {!canViewPositions ? (
            <EmptySection text={text("Нет доступа к просмотру должностей.", "No permission to view positions.")} />
          ) : positions.length === 0 ? (
            <EmptySection text={text("В отделе пока нет должностей.", "There are no positions in this department yet.")} />
          ) : (
            <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
              {positions.map((item) => {
                const id = positiveId(item.id);
                return (
                  <article className="app-surface-muted app-border rounded-2xl border p-4" key={String(item.id)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="app-text font-black">{recordName(item, text)}</p>
                        <p className="app-muted mt-2 text-xs leading-5">
                          {displayValue(item.responsibilities) === "—"
                            ? text("Обязанности не указаны", "Responsibilities not specified")
                            : String(item.responsibilities)}
                        </p>
                        <div className="mt-4">
                          <MiniBadge label={text("Сотрудников", "Employees")} value={canViewEmployees ? employeeCountByPosition.get(id ?? -1) ?? 0 : "—"} />
                        </div>
                      </div>
                      {(canEditPosition || canDeletePosition) && (
                        <RecordActions
                          className="shrink-0"
                          deleteLabel={text("Удалить должность", "Delete position")}
                          editLabel={text("Редактировать должность", "Edit position")}
                          onDelete={
                            canDeletePosition
                              ? () => openDeletePosition(item)
                              : undefined
                          }
                          onEdit={
                            canEditPosition
                              ? () => openEditPosition(item)
                              : undefined
                          }
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <SectionHeader
          icon={<FiUsers />}
          title={text("Сотрудники", "Employees")}
        />
        {!canViewEmployees ? (
          <EmptySection text={text("Нет доступа к просмотру сотрудников.", "No permission to view employees.")} />
        ) : employees.length === 0 ? (
          <EmptySection text={text("Сотрудники пока не добавлены.", "No employees have been added yet.")} />
        ) : (
          <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2 xl:grid-cols-3">
            {employees.slice(0, 12).map((item) => (
              <EmployeeCard employee={item} text={text} key={String(item.id)} />
            ))}
          </div>
        )}
      </section>

      {enterpriseId && canAssignLeader && (
        <DepartmentLeaderDialog
          canChangeEmployment={canAssignLeader}
          currentLeaderId={leaderEmployeeId}
          departmentId={departmentId}
          departmentName={department ? recordName(department, text) : ""}
          departments={departments}
          enterpriseId={enterpriseId}
          enterpriseName={recordName(enterprise, text)}
          mode={mode}
          onOpenChange={setIsLeaderDialogOpen}
          onSaved={() => setRefreshIndex((value) => value + 1)}
          open={isLeaderDialogOpen}
          positions={positions}
        />
      )}

      {mode === "enterprise" && enterpriseId && (canCreateDepartment || canEditDepartment) && (
        <HrEntityDialog
          entity="departments"
          hiddenFieldNames={["enterprise_id"]}
          initialRecord={departmentDialogMode === "create" ? { enterprise_id: enterpriseId } : editingDepartment}
          mode={departmentDialogMode}
          onOpenChange={setIsDepartmentFormOpen}
          onSubmit={saveDepartment}
          open={isDepartmentFormOpen}
        />
      )}
      {mode === "enterprise" && canDeleteDepartment && (
        <HrEntityDeleteDialog
          onConfirm={deleteDepartment}
          onOpenChange={(open) => {
            setIsDepartmentDeleteOpen(open);
            if (!open) setDeletingDepartment(null);
          }}
          open={isDepartmentDeleteOpen}
        />
      )}
      {mode === "department" && departmentId && (canCreatePosition || canEditPosition) && (
        <HrEntityDialog
          entity="positions"
          hiddenFieldNames={["department_id"]}
          initialRecord={positionDialogMode === "create" ? { department_id: departmentId } : editingPosition}
          mode={positionDialogMode}
          onOpenChange={setIsPositionFormOpen}
          onSubmit={savePosition}
          open={isPositionFormOpen}
        />
      )}
      {mode === "department" && canDeletePosition && (
        <HrEntityDeleteDialog
          onConfirm={deletePosition}
          onOpenChange={(open) => {
            setIsPositionDeleteOpen(open);
            if (!open) setDeletingPosition(null);
          }}
          open={isPositionDeleteOpen}
        />
      )}
    </motion.div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[24px] border p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="app-accent-soft flex h-11 w-11 items-center justify-center rounded-xl border text-lg">{icon}</span>
        <div>
          <p className="app-muted text-[11px] font-black uppercase tracking-wide">{label}</p>
          <p className="app-text mt-1 text-2xl font-black">{value}</p>
        </div>
      </div>
    </article>
  );
}

function InfoPanel({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }): JSX.Element {
  return (
    <section className="app-surface app-border overflow-hidden rounded-[28px] border">
      <div className="app-surface-muted app-border flex items-center gap-3 border-b px-5 py-4">
        <span className="app-accent-soft flex h-10 w-10 items-center justify-center rounded-xl border">{icon}</span>
        <h2 className="app-text text-lg font-black">{title}</h2>
      </div>
      <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div>
      <p className="app-muted text-[11px] font-black uppercase tracking-wide">{label}</p>
      <div className="app-text-soft mt-1.5 break-words text-sm font-bold leading-6">{value}</div>
    </div>
  );
}

function ContactCard({
  record,
  text,
}: {
  record: HrRecord;
  text: (ru: string, en: string) => string;
}): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[24px] border p-5">
      <p className="app-muted text-[11px] font-black uppercase tracking-wide">{text("Контакты", "Contacts")}</p>
      <div className="mt-4 space-y-3">
        <ContactRow icon={<FiPhone />} label={text("Телефон", "Phone")} value={displayValue(record.phone)} />
        <ContactRow icon={<FiMail />} label="Email" value={displayValue(record.email)} />
      </div>
    </article>
  );
}

function ContactRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <span className="app-accent-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">{icon}</span>
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
  text,
}: {
  canManage: boolean;
  canViewEmployee: boolean;
  employeeId: number | null;
  leaderName: string;
  onManage: () => void;
  title: string;
  text: (ru: string, en: string) => string;
}): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[24px] border p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-muted text-[11px] font-black uppercase tracking-wide">{title}</p>
          <p className="app-text mt-2 font-black">{leaderName}</p>
        </div>
        {canManage && (
          <ActionButton action="manage" onClick={onManage} size="sm" />
        )}
      </div>
      {employeeId && canViewEmployee && (
        <Link className="app-accent-text mt-3 inline-flex text-xs font-black" to={`/employees/${employeeId}`}>
          {text("Открыть сотрудника", "Open employee")}
        </Link>
      )}
    </article>
  );
}

function SectionHeader({
  actions,
  icon,
  title,
}: {
  actions?: ReactNode;
  icon: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <div className="app-surface-muted app-border flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="app-accent-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">{icon}</span>
        <h2 className="app-text text-lg font-black">{title}</h2>
      </div>
      {actions}
    </div>
  );
}

function MiniBadge({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <span className="app-surface app-border app-text-soft inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold">
      {label}: {value}
    </span>
  );
}

function EmployeeCard({
  employee,
  text,
}: {
  employee: HrRecord;
  text: (ru: string, en: string) => string;
}): JSX.Element {
  const id = positiveId(employee.id);
  const name = [employee.last_name, employee.first_name, employee.middle_name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return (
    <Link className="app-surface-muted app-border rounded-2xl border p-4 transition hover:border-[var(--accent-border)]" to={`/employees/${id}`}>
      <p className="app-text truncate font-black">{name || text("Сотрудник", "Employee")}</p>
      <p className="app-muted mt-1 truncate text-xs font-semibold">{displayValue(employee.position_name)}</p>
    </Link>
  );
}

function EmptySection({ text }: { text: string }): JSX.Element {
  return <p className="app-muted p-6 text-center text-sm font-semibold">{text}</p>;
}

async function loadAllRecords(
  entity: HrEntityKey,
  filters: OrganizationFilters,
  orderBy: string,
): Promise<HrRecord[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await hrApiClient.list({
      entity,
      page,
      pageSize: 100,
      filters,
      orderBy,
      orderDirection: "asc",
    });
    records.push(...result.items);
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);
  return records;
}

function countById(records: HrRecord[], key: string): Map<number, number> {
  const result = new Map<number, number>();
  for (const record of records) {
    const id = positiveId(record[key]);
    if (!id) continue;
    result.set(id, (result.get(id) ?? 0) + 1);
  }
  return result;
}

function recordName(
  record: HrRecord | null,
  text: (ru: string, en: string) => string,
): string {
  return String(record?.name ?? text("Без названия", "Untitled"));
}

function displayValue(value: unknown): string {
  const text = String(value ?? "").trim();
  return text || "—";
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
