import { useCallback, useEffect, useState } from "react";
import {
  FiArrowUpRight,
  FiClock,
  FiDollarSign,
  FiEdit3,
  FiUserX,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { useAppText } from "../../../shared/i18n";
import { formatCurrency, formatDate } from "../../../shared/lib/format";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { HrRecord } from "../../../shared/types/hr";
import {
  ActionButton,
  Dialog,
  FormActions,
  Input,
  SearchableSelect,
  Select,
  Textarea,
  type SelectOption,
} from "../../../shared/ui";
import {
  loadEmployeeRelationOptions,
  type DepartmentOption,
  type PositionOption,
} from "../lib/employeeRelations";

interface EmployeeLifecyclePanelProps {
  canChangeEmployment: boolean;
  canTerminate: boolean;
  employee: HrRecord;
  employeeId: number;
  locale: string;
  onEmployeeUpdated: (employee: HrRecord) => Promise<void>;
}

export function EmployeeLifecyclePanel({
  canChangeEmployment,
  canTerminate,
  employee,
  employeeId,
  locale,
  onEmployeeUpdated,
}: EmployeeLifecyclePanelProps): JSX.Element {
  const text = useAppText();
  const [history, setHistory] = useState<HrRecord[]>([]);
  const [enterprises, setEnterprises] = useState<SelectOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [careerOpen, setCareerOpen] = useState(false);
  const [terminationOpen, setTerminationOpen] = useState(false);
  const [rehireOpen, setRehireOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const lifecycleStatus = String(employee.lifecycle_status ?? employee.status ?? "");
  const isPending = ["draft", "pending_assignment"].includes(lifecycleStatus);
  const isActive = lifecycleStatus === "active" || String(employee.status) === "active";
  const isTerminated = lifecycleStatus === "terminated";
  const [career, setCareer] = useState({
    enterpriseId: String(employee.enterprise_id ?? ""),
    departmentId: String(employee.department_id ?? ""),
    positionId: String(employee.position_id ?? ""),
    salaryMode: "keep",
    salary: String(employee.salary ?? 0),
    effectiveAt: today,
    reason: "",
  });
  const [termination, setTermination] = useState({
    effectiveAt: today,
    reason: "",
  });
  const [rehire, setRehire] = useState({
    enterpriseId: String(employee.enterprise_id ?? ""),
    departmentId: String(employee.department_id ?? ""),
    positionId: String(employee.position_id ?? ""),
    effectiveAt: today,
    salary: String(employee.salary ?? 0),
    reason: "",
    employeeNumber: String(employee.employee_number ?? ""),
    employmentType: String(employee.employment_type ?? "full_time"),
    contractNumber: String(employee.contract_number ?? ""),
    contractDate: String(employee.contract_date ?? ""),
    contractEndDate: String(employee.contract_end_date ?? ""),
    probationEndDate: String(employee.probation_end_date ?? ""),
    workplace: String(employee.workplace ?? ""),
  });
  const [correction, setCorrection] = useState({
    hireDate: String(employee.hire_date ?? ""),
    reason: "",
  });

  const loadData = useCallback(async () => {
    const historyResult = await hrApiClient.list({
      entity: "employment_history",
      page: 1,
      pageSize: 100,
      filters: { employee_id: employeeId },
      orderBy: "effective_at",
      orderDirection: "desc",
    });
    setHistory(historyResult.items);

    if (!canChangeEmployment) {
      setEnterprises([]);
      setDepartments([]);
      setPositions([]);
      return;
    }

    const relationOptions = await loadEmployeeRelationOptions();
    setEnterprises(relationOptions.enterprises);
    setDepartments(relationOptions.departments);
    setPositions(relationOptions.positions);
  }, [canChangeEmployment, employeeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const departmentId = String(employee.department_id ?? "");
    const enterpriseId =
      departments.find((department) => department.value === departmentId)
        ?.enterpriseId ?? String(employee.enterprise_id ?? "");
    setCareer((current) => ({
      ...current,
      enterpriseId,
      departmentId,
      positionId: String(employee.position_id ?? ""),
      salary: String(employee.salary ?? 0),
    }));
    setCorrection((current) => ({
      ...current,
      hireDate: String(employee.hire_date ?? ""),
    }));
    setRehire((current) => ({
      ...current,
      enterpriseId,
      departmentId,
      positionId: String(employee.position_id ?? ""),
      salary: String(employee.salary ?? 0),
      employeeNumber: String(employee.employee_number ?? ""),
      employmentType: String(employee.employment_type ?? "full_time"),
      contractNumber: String(employee.contract_number ?? ""),
      contractDate: String(employee.contract_date ?? ""),
      contractEndDate: String(employee.contract_end_date ?? ""),
      probationEndDate: String(employee.probation_end_date ?? ""),
      workplace: String(employee.workplace ?? ""),
    }));
  }, [departments, employee]);

  const availableDepartments = career.enterpriseId
    ? departments.filter(
        (department) => department.enterpriseId === career.enterpriseId,
      )
    : [];
  const availablePositions = career.departmentId
    ? positions.filter(
        (position) => position.departmentId === career.departmentId,
      )
    : [];
  const rehireDepartments = rehire.enterpriseId
    ? departments.filter(
        (department) => department.enterpriseId === rehire.enterpriseId,
      )
    : [];
  const rehirePositions = rehire.departmentId
    ? positions.filter(
        (position) => position.departmentId === rehire.departmentId,
      )
    : [];

  const currentAssignmentStartedAt = String(
    history.find(
      (item) =>
        String(item.new_position_id ?? "") ===
          String(employee.position_id ?? "") &&
        String(item.change_type ?? "") !== "terminated",
    )?.effective_at ??
      employee.hire_date ??
      "",
  );
  const careerEndDate = isActive || isPending ? undefined : String(employee.terminated_at ?? "");

  async function saveCareerChange(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canChangeEmployment) return;
    if (!career.enterpriseId || !career.departmentId || !career.positionId) {
      toast.error(text("Выберите предприятие, отдел и должность", "Select an enterprise, department, and position"));
      return;
    }
    setSaving(true);
    try {
      const updated = await hrApiClient.changeEmployment({
        employeeId,
        enterpriseId: Number(career.enterpriseId),
        departmentId: Number(career.departmentId),
        positionId: Number(career.positionId),
        salaryMode: career.salaryMode as "keep" | "custom",
        salary:
          career.salaryMode === "custom" ? Number(career.salary) : undefined,
        effectiveAt: career.effectiveAt,
        reason: career.reason,
      });
      await onEmployeeUpdated(updated);
      await loadData();
      setCareerOpen(false);
      setCareer((current) => ({ ...current, reason: "" }));
      toast.success(
        isPending
          ? text("Карточка сотрудника полностью оформлена", "Employee profile completed")
          : text("Кадровое изменение сохранено в журнале", "Employment change saved to history"),
      );
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось сохранить кадровое изменение", "Failed to save employment change")));
    } finally {
      setSaving(false);
    }
  }

  async function saveRehire(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canChangeEmployment || !isTerminated) return;
    if (!rehire.enterpriseId || !rehire.departmentId || !rehire.positionId) {
      toast.error(text("Выберите предприятие, отдел и должность", "Select an enterprise, department, and position"));
      return;
    }

    setSaving(true);
    try {
      const updated = await hrApiClient.rehireEmployee({
        employeeId,
        enterpriseId: Number(rehire.enterpriseId),
        departmentId: Number(rehire.departmentId),
        positionId: Number(rehire.positionId),
        effectiveAt: rehire.effectiveAt,
        salary: Number(rehire.salary),
        reason: rehire.reason,
        employeeNumber: rehire.employeeNumber || undefined,
        employmentType: rehire.employmentType || undefined,
        contractNumber: rehire.contractNumber || undefined,
        contractDate: rehire.contractDate || undefined,
        contractEndDate: rehire.contractEndDate || undefined,
        probationEndDate: rehire.probationEndDate || undefined,
        workplace: rehire.workplace || undefined,
      });
      await onEmployeeUpdated(updated);
      await loadData();
      setRehireOpen(false);
      setRehire((current) => ({ ...current, reason: "" }));
      toast.success(text("Повторный приём сохранён в кадровом журнале", "Rehire saved to employment history"));
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось повторно принять сотрудника", "Failed to rehire employee")));
    } finally {
      setSaving(false);
    }
  }

  async function terminate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canTerminate) return;
    setSaving(true);
    try {
      const updated = await hrApiClient.terminateEmployee({
        employeeId,
        effectiveAt: termination.effectiveAt,
        reason: termination.reason,
      });
      await onEmployeeUpdated(updated);
      await loadData();
      setTerminationOpen(false);
      setTermination((current) => ({ ...current, reason: "" }));
      toast.success(text("Увольнение зафиксировано в кадровом журнале", "Termination recorded in employment history"));
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось оформить увольнение", "Failed to terminate employee")));
    } finally {
      setSaving(false);
    }
  }

  async function correctHireDate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canChangeEmployment) return;
    setSaving(true);
    try {
      const updated = await hrApiClient.correctHireDate({
        employeeId,
        hireDate: correction.hireDate,
        reason: correction.reason,
      });
      await onEmployeeUpdated(updated);
      await loadData();
      setCorrectionOpen(false);
      setCorrection((current) => ({ ...current, reason: "" }));
      toast.success(text("Дата приёма исправлена вместе с кадровым журналом", "Hire date corrected together with employment history"));
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось исправить дату приёма", "Failed to correct hire date")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric
          icon={<FiClock />}
          label={text("Общий стаж", "Total tenure")}
          value={
            isPending
              ? text("Не начат", "Not started")
              : totalEmploymentDuration(
                  history,
                  isActive,
                  String(employee.hire_date ?? ""),
                  careerEndDate,
                  locale,
                )
          }
        />
        <Metric
          icon={<FiArrowUpRight />}
          label={text("На текущей должности", "In current position")}
          value={
            isActive
              ? employee.position_id
                ? durationBetween(currentAssignmentStartedAt, undefined, locale)
                : text("Не назначена", "Not assigned")
              : text("Работа завершена", "Employment ended")
          }
        />
        <Metric
          icon={<FiDollarSign />}
          label={text("Текущий оклад", "Current salary")}
          value={formatCurrency(employee.salary, locale)}
        />
      </div>

      <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.18em]">
              {text("Карьера", "Career")}
            </p>
            <h2 className="app-text mt-1 text-xl font-black">
              {text("Кадровый журнал", "Employment history")}
            </h2>
          </div>
          {(canChangeEmployment || canTerminate) && (
            <div className="flex flex-wrap gap-2">
              {canChangeEmployment && !isPending && (
                <ActionButton
                  action="edit"
                  onClick={() => setCorrectionOpen(true)}
                >
                  {text("Исправить дату приёма", "Correct hire date")}
                </ActionButton>
              )}
              {(isActive || isPending) && canChangeEmployment && (
                <ActionButton
                  action={isPending ? "hire" : "edit"}
                  onClick={() => setCareerOpen(true)}
                >
                  {isPending ? text("Дооформить сотрудника", "Complete employee profile") : text("Кадровое изменение", "Employment change")}
                </ActionButton>
              )}
              {isActive && canTerminate && (
                <ActionButton
                  action="terminate"
                  onClick={() => setTerminationOpen(true)}
                />
              )}
              {isTerminated && canChangeEmployment && (
                <ActionButton
                  action="hire"
                  onClick={() => setRehireOpen(true)}
                >
                  {text("Принять повторно", "Rehire")}
                </ActionButton>
              )}
            </div>
          )}
        </div>
        <div className="mt-5 space-y-3">
          {history.map((item) => (
            <HistoryItem key={String(item.id)} item={item} locale={locale} text={text} />
          ))}
          {history.length === 0 && (
            <p className="app-muted rounded-2xl border border-dashed p-5 text-sm">
              {text("Кадровых событий пока нет.", "No employment events yet.")}
            </p>
          )}
        </div>
      </section>

      {canChangeEmployment && (
        <>
          <Dialog
            open={careerOpen}
            onOpenChange={setCareerOpen}
            title={isPending ? text("Дооформить сотрудника", "Complete employee profile") : text("Кадровое изменение", "Employment change")}
            description={
              isPending
                ? text("Заполните недостающие кадровые данные: предприятие, отдел, должность, дату и основание.", "Fill in the missing employment data: enterprise, department, position, date, and reason.")
                : text("Перевод между предприятиями и отделами, смена должности или оклада с обязательной датой и основанием.", "Transfer between enterprises or departments, position or salary changes, with a required date and reason.")
            }
          >
            <form className="grid gap-4" onSubmit={saveCareerChange}>
              <Field label={text("Предприятие", "Enterprise")}>
                <SearchableSelect
                  options={enterprises}
                  value={career.enterpriseId}
                  onValueChange={(enterpriseId) =>
                    setCareer((value) => ({
                      ...value,
                      enterpriseId,
                      departmentId: "",
                      positionId: "",
                    }))
                  }
                  placeholder={text("Выберите предприятие", "Select enterprise")}
                  searchPlaceholder={text("Поиск предприятия", "Search enterprise")}
                />
              </Field>
              <Field label={text("Отдел", "Department")}>
                <SearchableSelect
                  disabled={!career.enterpriseId}
                  options={availableDepartments}
                  value={career.departmentId}
                  onValueChange={(departmentId) =>
                    setCareer((value) => ({ ...value, departmentId, positionId: "" }))
                  }
                  placeholder={
                    career.enterpriseId
                      ? text("Выберите отдел", "Select department")
                      : text("Сначала выберите предприятие", "Select enterprise first")
                  }
                  searchPlaceholder={text("Поиск отдела", "Search department")}
                />
              </Field>
              <Field label={text("Новая должность", "New position")}>
                <SearchableSelect
                  disabled={!career.departmentId}
                  options={availablePositions}
                  value={career.positionId}
                  onValueChange={(positionId) =>
                    setCareer((value) => ({ ...value, positionId }))
                  }
                  placeholder={
                    career.departmentId
                      ? text("Выберите должность", "Select position")
                      : text("Сначала выберите отдел", "Select department first")
                  }
                  searchPlaceholder={text("Поиск должности", "Search position")}
                />
              </Field>
              <Field label={text("Оклад", "Salary")}>
                <Select
                  value={career.salaryMode}
                  onValueChange={(salaryMode) =>
                    setCareer((value) => ({ ...value, salaryMode }))
                  }
                  options={[
                    { value: "keep", label: text("Оставить без изменений", "Keep unchanged") },
                    { value: "custom", label: text("Указать новый оклад", "Set new salary") },
                  ]}
                />
              </Field>
              {career.salaryMode === "custom" && (
                <Field label={text("Новый оклад", "New salary")}>
                  <Input
                    min="0"
                    type="number"
                    value={career.salary}
                    onChange={(event) =>
                      setCareer((value) => ({ ...value, salary: event.target.value }))
                    }
                  />
                </Field>
              )}
              <Field label={text("Дата вступления в силу", "Effective date")}>
                <Input
                  required
                  type="date"
                  value={career.effectiveAt}
                  onChange={(event) =>
                    setCareer((value) => ({ ...value, effectiveAt: event.target.value }))
                  }
                />
              </Field>
              <Field label={text("Основание изменения", "Change reason")}>
                <Textarea
                  required
                  placeholder={text("Например: перевод в другое предприятие по приказу №12", "For example: transfer to another enterprise under order #12")}
                  rows={3}
                  value={career.reason}
                  onChange={(event) =>
                    setCareer((value) => ({ ...value, reason: event.target.value }))
                  }
                />
              </Field>
              <FormActions
              loading={saving}
              onCancel={() => setCareerOpen(false)}
              submitLabel={text("Сохранить", "Save")}
            />
            </form>
          </Dialog>

          <Dialog
            open={correctionOpen}
            onOpenChange={setCorrectionOpen}
            title={text("Исправить дату приёма", "Correct hire date")}
            description={text("Исправление синхронно обновит карточку сотрудника и исходную запись о приёме в кадровом журнале.", "The correction will update both the employee profile and the original hire event in employment history.")}
          >
            <form className="grid gap-4" onSubmit={correctHireDate}>
              <Field label={text("Дата приёма", "Hire date")}>
                <Input
                  required
                  type="date"
                  value={correction.hireDate}
                  onChange={(event) =>
                    setCorrection((value) => ({ ...value, hireDate: event.target.value }))
                  }
                />
              </Field>
              <Field label={text("Причина исправления", "Correction reason")}>
                <Textarea
                  required
                  rows={3}
                  value={correction.reason}
                  onChange={(event) =>
                    setCorrection((value) => ({ ...value, reason: event.target.value }))
                  }
                />
              </Field>
              <FormActions
              loading={saving}
              onCancel={() => setCorrectionOpen(false)}
              submitLabel={text("Сохранить", "Save")}
            />
            </form>
          </Dialog>
        </>
      )}

      {canChangeEmployment && isTerminated && (
        <Dialog
          open={rehireOpen}
          onOpenChange={setRehireOpen}
          title={text("Принять сотрудника повторно", "Rehire employee")}
          description={text("Будет продолжена существующая карточка сотрудника. Предыдущий период работы и увольнение останутся в кадровой истории.", "The existing employee profile will be continued. Previous employment and termination remain in employment history.")}
        >
          <form className="grid gap-4" onSubmit={saveRehire}>
            <Field label={text("Предприятие", "Enterprise")}>
              <SearchableSelect
                options={enterprises}
                value={rehire.enterpriseId}
                onValueChange={(enterpriseId) =>
                  setRehire((value) => ({
                    ...value,
                    enterpriseId,
                    departmentId: "",
                    positionId: "",
                  }))
                }
                placeholder={text("Выберите предприятие", "Select enterprise")}
                searchPlaceholder={text("Поиск предприятия", "Search enterprise")}
              />
            </Field>
            <Field label={text("Отдел", "Department")}>
              <SearchableSelect
                disabled={!rehire.enterpriseId}
                options={rehireDepartments}
                value={rehire.departmentId}
                onValueChange={(departmentId) =>
                  setRehire((value) => ({
                    ...value,
                    departmentId,
                    positionId: "",
                  }))
                }
                placeholder={
                  rehire.enterpriseId
                    ? text("Выберите отдел", "Select department")
                    : text("Сначала выберите предприятие", "Select enterprise first")
                }
                searchPlaceholder={text("Поиск отдела", "Search department")}
              />
            </Field>
            <Field label={text("Должность", "Position")}>
              <SearchableSelect
                disabled={!rehire.departmentId}
                options={rehirePositions}
                value={rehire.positionId}
                onValueChange={(positionId) =>
                  setRehire((value) => ({ ...value, positionId }))
                }
                placeholder={
                  rehire.departmentId
                    ? text("Выберите должность", "Select position")
                    : text("Сначала выберите отдел", "Select department first")
                }
                searchPlaceholder={text("Поиск должности", "Search position")}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={text("Дата повторного приёма", "Rehire date")}>
                <Input
                  required
                  type="date"
                  value={rehire.effectiveAt}
                  onChange={(event) =>
                    setRehire((value) => ({
                      ...value,
                      effectiveAt: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={text("Оклад", "Salary")}>
                <Input
                  min="0"
                  required
                  type="number"
                  value={rehire.salary}
                  onChange={(event) =>
                    setRehire((value) => ({
                      ...value,
                      salary: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={text("Табельный номер", "Employee number")}>
                <Input
                  value={rehire.employeeNumber}
                  onChange={(event) =>
                    setRehire((value) => ({
                      ...value,
                      employeeNumber: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={text("Тип занятости", "Employment type")}>
                <Select
                  value={rehire.employmentType}
                  onValueChange={(employmentType) =>
                    setRehire((value) => ({ ...value, employmentType }))
                  }
                  options={[
                    { value: "full_time", label: text("Полная занятость", "Full-time") },
                    { value: "part_time", label: text("Частичная занятость", "Part-time") },
                    { value: "temporary", label: text("Временная работа", "Temporary") },
                    { value: "internship", label: text("Стажировка", "Internship") },
                  ]}
                />
              </Field>
              <Field label={text("Номер договора", "Contract number")}>
                <Input
                  value={rehire.contractNumber}
                  onChange={(event) =>
                    setRehire((value) => ({
                      ...value,
                      contractNumber: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={text("Дата договора", "Contract date")}>
                <Input
                  type="date"
                  value={rehire.contractDate}
                  onChange={(event) =>
                    setRehire((value) => ({
                      ...value,
                      contractDate: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={text("Окончание договора", "Contract end date")}>
                <Input
                  type="date"
                  value={rehire.contractEndDate}
                  onChange={(event) =>
                    setRehire((value) => ({
                      ...value,
                      contractEndDate: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={text("Испытательный срок до", "Probation end date")}>
                <Input
                  type="date"
                  value={rehire.probationEndDate}
                  onChange={(event) =>
                    setRehire((value) => ({
                      ...value,
                      probationEndDate: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <Field label={text("Место работы", "Workplace")}>
              <Input
                value={rehire.workplace}
                onChange={(event) =>
                  setRehire((value) => ({
                    ...value,
                    workplace: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label={text("Основание повторного приёма", "Rehire reason")}>
              <Textarea
                required
                rows={3}
                value={rehire.reason}
                onChange={(event) =>
                  setRehire((value) => ({
                    ...value,
                    reason: event.target.value,
                  }))
                }
                placeholder={text("Например: приказ о повторном приёме №15", "For example: rehire order #15")}
              />
            </Field>
            <FormActions
              loading={saving}
              onCancel={() => setRehireOpen(false)}
              submitAction="hire"
              submitLabel={text("Принять повторно", "Rehire")}
            />
          </form>
        </Dialog>
      )}

      {canTerminate && (
        <Dialog
          open={terminationOpen}
          onOpenChange={setTerminationOpen}
          title={text("Уволить сотрудника", "Terminate employee")}
          description={text("Карточка и вся кадровая история останутся в системе. Связанная учётная запись будет заблокирована автоматически.", "The employee profile and full employment history will remain in the system. The linked account will be blocked automatically.")}
        >
          <form className="grid gap-4" onSubmit={terminate}>
            <Field label={text("Дата увольнения", "Termination date")}>
              <Input
                required
                type="date"
                value={termination.effectiveAt}
                onChange={(event) =>
                  setTermination((value) => ({
                    ...value,
                    effectiveAt: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label={text("Основание увольнения", "Termination reason")}>
              <Textarea
                required
                placeholder={text("Приказ, заявление или иное основание", "Order, resignation letter, or other reason")}
                rows={4}
                value={termination.reason}
                onChange={(event) =>
                  setTermination((value) => ({ ...value, reason: event.target.value }))
                }
              />
            </Field>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {text("Сотрудник не удаляется: он переходит в завершённый кадровый статус, а данные остаются доступны в истории.", "The employee is not deleted: their employment status becomes completed and the data remains available in history.")}
            </div>
            <FormActions
              loading={saving}
              onCancel={() => setTerminationOpen(false)}
              submitAction="terminate"
              submitLabel={text("Подтвердить увольнение", "Confirm termination")}
            />
          </form>
        </Dialog>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="app-surface app-border flex items-center gap-4 rounded-[20px] border p-4">
      <span className="app-accent-soft flex h-11 w-11 items-center justify-center rounded-2xl">
        {icon}
      </span>
      <div>
        <p className="app-muted text-xs font-bold uppercase tracking-wide">{label}</p>
        <p className="app-text mt-1 text-lg font-black">{value}</p>
      </div>
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}

function HistoryItem({
  item,
  locale,
  text,
}: {
  item: HrRecord;
  locale: string;
  text: (ru: string, en: string) => string;
}): JSX.Element {
  const changeType = String(item.change_type ?? "");
  const terminated = changeType === "terminated";
  const hired = changeType === "hired" || changeType === "rehired";
  const previousEnterprise = String(item.previous_enterprise_name ?? "").trim();
  const nextEnterprise = String(item.new_enterprise_name ?? "").trim();
  const previousDepartment = String(item.previous_department_name ?? "").trim();
  const nextDepartment = String(item.new_department_name ?? "").trim();
  const enterpriseChanged =
    Boolean(previousEnterprise && nextEnterprise) &&
    previousEnterprise !== nextEnterprise;
  const departmentChanged =
    Boolean(previousDepartment && nextDepartment) &&
    previousDepartment !== nextDepartment;

  const title = terminated
    ? text("Увольнение", "Termination")
    : changeType === "rehired"
      ? text("Повторный приём на работу", "Rehire")
      : hired
        ? text("Приём на работу", "Hire")
      : changeType === "enterprise_director"
        ? text("Назначение руководителем предприятия", "Enterprise director assignment")
        : changeType === "department_leader"
          ? text("Назначение руководителем отдела", "Department head assignment")
          : enterpriseChanged
            ? text("Перевод между предприятиями", "Transfer between enterprises")
            : departmentChanged
              ? text("Перевод между отделами", "Transfer between departments")
              : String(item.new_position_name ?? text("Кадровое изменение", "Employment change"));

  const enterprise = transitionValue(
    previousEnterprise,
    nextEnterprise,
    hired,
    terminated,
  );
  const department = transitionValue(
    previousDepartment,
    nextDepartment,
    hired,
    terminated,
  );
  const salary = terminated ? item.previous_salary : item.new_salary;
  const context = [
    enterprise,
    department,
    salary !== null && salary !== undefined
      ? formatCurrency(salary, locale)
      : "",
  ].filter(Boolean);

  return (
    <article className="app-surface app-border rounded-2xl border p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="app-text flex items-center gap-2 font-black">
          {terminated ? <FiUserX /> : hired ? <FiEdit3 /> : null}
          {title}
        </p>
        <time className="app-muted text-sm font-bold">
          {formatDate(item.effective_at, locale)}
        </time>
      </div>
      <p className="app-muted mt-2 text-sm">
        {context.length > 0 ? context.join(" · ") : text("Оргструктура не указана", "Organization structure not specified")}
      </p>
      <p className="app-muted mt-2 text-xs">
        {String(item.reason ?? text("Кадровое изменение", "Employment change"))}
      </p>
    </article>
  );
}

function transitionValue(
  previousValue: string,
  nextValue: string,
  hired: boolean,
  terminated: boolean,
): string {
  if (hired) return nextValue;
  if (terminated) return previousValue;
  if (previousValue && nextValue && previousValue !== nextValue) {
    return `${previousValue} → ${nextValue}`;
  }
  return nextValue || previousValue;
}

function totalEmploymentDuration(
  history: HrRecord[],
  isActive: boolean,
  fallbackStart: string,
  fallbackEnd: string | undefined,
  locale: string,
): string {
  const events = [...history].sort((left, right) =>
    String(left.effective_at ?? "").localeCompare(
      String(right.effective_at ?? ""),
    ),
  );
  let currentStart: string | null = null;
  let totalMs = 0;

  for (const event of events) {
    const type = String(event.change_type ?? "");
    const date = String(event.effective_at ?? "");
    if (!date) continue;

    if ((type === "hired" || type === "rehired") && !currentStart) {
      currentStart = date;
      continue;
    }
    if (type === "terminated" && currentStart) {
      const start = new Date(`${currentStart}T00:00:00`).getTime();
      const end = new Date(`${date}T00:00:00`).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        totalMs += end - start;
      }
      currentStart = null;
    }
  }

  if (currentStart && isActive) {
    const start = new Date(`${currentStart}T00:00:00`).getTime();
    if (Number.isFinite(start)) totalMs += Date.now() - start;
  }

  if (totalMs <= 0) {
    return durationBetween(fallbackStart, fallbackEnd, locale);
  }

  const months = Math.max(0, Math.floor(totalMs / 2629800000));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return formatDuration(years, rest, locale);
}

function durationBetween(
  startDate: string,
  endDate: string | undefined,
  locale: string,
): string {
  if (!startDate) return "—";
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = endDate
    ? new Date(`${endDate}T00:00:00`).getTime()
    : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const months = Math.max(0, Math.floor((end - start) / 2629800000));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return formatDuration(years, rest, locale);
}

function formatDuration(years: number, months: number, locale: string): string {
  return locale.startsWith("en")
    ? years
      ? `${years} yr ${months} mo`
      : `${months} mo`
    : years
      ? `${years} г. ${months} мес.`
      : `${months} мес.`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const marker = "Error: ";
  const markerIndex = error.message.lastIndexOf(marker);
  return markerIndex >= 0
    ? error.message.slice(markerIndex + marker.length)
    : error.message;
}
