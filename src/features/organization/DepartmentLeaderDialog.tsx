import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord, PreviousLeaderOutcome } from "../../shared/types/hr";
import {
  ActionButton,
  Dialog,
  Input,
  LoadingState,
  SearchableSelect,
  Textarea,
  type SelectOption,
} from "../../shared/ui";

type LeadershipMode = "enterprise" | "department";

interface DepartmentLeaderDialogProps {
  canChangeEmployment: boolean;
  currentLeaderId: number | null;
  departmentId: number | null;
  departmentName: string;
  departments: HrRecord[];
  enterpriseId: number;
  enterpriseName: string;
  mode: LeadershipMode;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  open: boolean;
  positions: HrRecord[];
}

interface LeadershipChangeForm {
  effectiveAt: string;
  reason: string;
  salary: string;
}

interface PreviousLeaderForm {
  outcome: PreviousLeaderOutcome;
  departmentId: string;
  positionId: string;
  salary: string;
}

export function DepartmentLeaderDialog({
  canChangeEmployment,
  currentLeaderId,
  departmentId,
  departmentName,
  departments,
  enterpriseId,
  enterpriseName,
  mode,
  onOpenChange,
  onSaved,
  open,
  positions,
}: DepartmentLeaderDialogProps): JSX.Element {
  const text = useAppText();
  const previousOutcomeOptions: SelectOption[] = [
    { value: "unassigned", label: text("Временно оставить без должности", "Temporarily leave without a position") },
    { value: "assign_position", label: text("Назначить на обычную должность", "Assign to a regular position") },
    { value: "transfer", label: text("Перевести в другой отдел / на другую должность", "Transfer to another department / position") },
  ];
  const [candidates, setCandidates] = useState<HrRecord[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [changeForm, setChangeForm] = useState<LeadershipChangeForm>(() =>
    createLeadershipChangeForm(),
  );
  const [previousForm, setPreviousForm] = useState<PreviousLeaderForm>(() =>
    createPreviousLeaderForm(),
  );

  const targetDepartments = useMemo(
    () => departments.filter((item) => Number(item.enterprise_id) === enterpriseId),
    [departments, enterpriseId],
  );

  useEffect(() => {
    if (!open) {
      setCandidates([]);
      setLeaderId("");
      setConfirming(false);
      setChangeForm(createLeadershipChangeForm());
      setPreviousForm(createPreviousLeaderForm());
      return;
    }

    let active = true;
    setLoading(true);
    setConfirming(false);
    void loadActiveEmployees()
      .then((records) => {
        if (!active) return;
        setCandidates(records);
        const currentValue = currentLeaderId ? String(currentLeaderId) : "";
        setLeaderId(currentValue);
        const currentLeader = records.find((record) => String(record.id) === currentValue);
        setChangeForm(createLeadershipChangeForm(currentLeader));
        setPreviousForm(createPreviousLeaderForm(currentLeader));
      })
      .catch((error) => {
        if (!active) return;
        toast.error(errorMessage(error, text("Не удалось загрузить сотрудников", "Failed to load employees")));
        onOpenChange(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentLeaderId, onOpenChange, open, text]);

  const options = useMemo<SelectOption[]>(
    () =>
      candidates.map((candidate) => ({
        value: String(candidate.id),
        label: candidateLabel(candidate, text),
      })),
    [candidates, text],
  );

  const departmentOptions = useMemo<SelectOption[]>(
    () =>
      targetDepartments.map((department) => ({
        value: String(department.id),
        label: String(department.name ?? text("Отдел", "Department")),
      })),
    [targetDepartments, text],
  );

  const previousPositionOptions = useMemo<SelectOption[]>(() => {
    const targetDepartmentId = positiveId(previousForm.departmentId);
    return positions
      .filter(
        (position) =>
          Number(position.department_id) === targetDepartmentId &&
          Number(position.is_archived ?? 0) !== 1,
      )
      .map((position) => ({
        value: String(position.id),
        label: String(position.name ?? text("Должность", "Position")),
      }));
  }, [positions, previousForm.departmentId, text]);

  const selectedCandidate = candidates.find(
    (candidate) => String(candidate.id) === leaderId,
  );
  const currentLeader = candidates.find(
    (candidate) => Number(candidate.id) === currentLeaderId,
  );
  const selectedAlreadyLeads =
    Boolean(currentLeaderId) && leaderId === String(currentLeaderId);
  const isChangingLeadership = !selectedAlreadyLeads && (Boolean(currentLeaderId) || Boolean(leaderId));
  const leadershipTitle =
    mode === "enterprise" ? text("директором предприятия", "enterprise director") : text("руководителем отдела", "department head");
  const fixedPositionLabel =
    mode === "enterprise"
      ? text(`Директор предприятия — ${enterpriseName}`, `Enterprise director — ${enterpriseName}`)
      : text(`Руководитель отдела — ${departmentName}`, `Department head — ${departmentName}`);
  const canAssignEnterpriseLeader = mode !== "enterprise" || targetDepartments.length > 0;

  function selectCandidate(value: string): void {
    setLeaderId(value);
    setConfirming(false);
    const candidate = candidates.find((record) => String(record.id) === value);
    setChangeForm((current) => ({
      ...current,
      salary: String(candidate?.salary ?? 0),
    }));
  }

  function requestSave(): void {
    if (loading) return;
    if (selectedAlreadyLeads) {
      onOpenChange(false);
      return;
    }
    if (!isChangingLeadership) {
      onOpenChange(false);
      return;
    }
    if (!canChangeEmployment) {
      toast.error(
        text("Назначение, замена и снятие руководителя являются кадровыми изменениями. Требуется разрешение «Кадровые изменения»", "Assigning, replacing, or removing a leader is an employment change. The Employment changes permission is required."),
      );
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(changeForm.effectiveAt)) {
      toast.error(text("Укажите дату вступления кадрового изменения в силу", "Specify the effective date of the employment change"));
      return;
    }
    if (!changeForm.reason.trim()) {
      toast.error(text("Укажите основание кадрового изменения", "Specify the reason for the employment change"));
      return;
    }

    if (leaderId) {
      if (!selectedCandidate) {
        toast.error(text("Выберите сотрудника", "Select an employee"));
        return;
      }
      if (!canAssignEnterpriseLeader) {
        toast.error(
          text("Для назначения директора предприятия в предприятии должен быть создан хотя бы один отдел", "At least one department must exist before assigning an enterprise director"),
        );
        return;
      }
      const salary = Number(changeForm.salary);
      if (!changeForm.salary.trim() || !Number.isFinite(salary) || salary < 0) {
        toast.error(text("Укажите корректный оклад нового руководителя", "Enter a valid salary for the new leader"));
        return;
      }
    }

    if (currentLeaderId && previousForm.outcome !== "unassigned") {
      const previousDepartmentId = positiveId(previousForm.departmentId);
      const previousPositionId = positiveId(previousForm.positionId);
      const salary = Number(previousForm.salary);
      if (!previousDepartmentId || !previousPositionId) {
        toast.error(text("Выберите отдел и должность для прежнего руководителя", "Select a department and position for the previous leader"));
        return;
      }
      if (!Number.isFinite(salary) || salary < 0) {
        toast.error(text("Укажите корректный оклад прежнего руководителя", "Enter a valid salary for the previous leader"));
        return;
      }
    }

    setConfirming(true);
  }

  async function save(): Promise<void> {
    if (loading || selectedAlreadyLeads || !canChangeEmployment) return;

    const targetDepartmentId = selectedCandidate
      ? resolveTargetDepartmentId(selectedCandidate, mode, departmentId, targetDepartments)
      : null;
    if (selectedCandidate && !targetDepartmentId) {
      toast.error(
        text("Для назначения директора предприятия в предприятии должен быть создан хотя бы один отдел", "At least one department must exist before assigning an enterprise director"),
      );
      setConfirming(false);
      return;
    }

    const previousDepartmentId = positiveId(previousForm.departmentId);
    const previousPositionId = positiveId(previousForm.positionId);

    setLoading(true);
    try {
      await hrApiClient.changeLeadership({
        targetType: mode,
        targetId: mode === "enterprise" ? enterpriseId : departmentId!,
        newLeaderEmployeeId: selectedCandidate ? Number(selectedCandidate.id) : null,
        effectiveAt: changeForm.effectiveAt,
        reason: changeForm.reason.trim(),
        previousLeaderOutcome: currentLeaderId ? previousForm.outcome : "unassigned",
        previousLeaderAssignment:
          currentLeaderId &&
          previousForm.outcome !== "unassigned" &&
          previousDepartmentId &&
          previousPositionId
            ? {
                enterpriseId,
                departmentId: previousDepartmentId,
                positionId: previousPositionId,
                salary: Number(previousForm.salary),
              }
            : undefined,
        newLeaderEmployment:
          selectedCandidate && targetDepartmentId
            ? {
                enterpriseId,
                departmentId: targetDepartmentId,
                salary: Number(changeForm.salary),
              }
            : undefined,
      });

      toast.success(
        selectedCandidate
          ? currentLeaderId
            ? text("Руководитель заменён, кадровая история сохранена", "Leader replaced and employment history preserved")
            : mode === "enterprise"
              ? text("Сотрудник назначен директором предприятия", "Employee assigned as enterprise director")
              : text("Сотрудник назначен руководителем отдела", "Employee assigned as department head")
          : text("Руководитель снят, кадровая история сохранена", "Leader removed and employment history preserved"),
      );
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось выполнить кадровое изменение руководителя", "Failed to apply leadership employment change")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      description={
        confirming
          ? text("Проверьте условия и подтвердите единое кадровое действие.", "Review the details and confirm the employment action.")
          : text(`Назначение, замена и снятие ${leadershipTitle} фиксируются в кадровой истории.`, `Assigning, replacing, and removing the ${leadershipTitle} is recorded in employment history.`)
      }
      onOpenChange={onOpenChange}
      open={open}
      title={
        mode === "enterprise"
          ? text("Управление директором предприятия", "Manage enterprise director")
          : text("Управление руководителем отдела", "Manage department head")
      }
    >
      {loading && candidates.length === 0 ? (
        <LoadingState label={text("Загрузка сотрудников...", "Loading employees...")} />
      ) : confirming ? (
        <div className="grid gap-5">
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
            <p className="app-text text-base font-black">{text("Подтвердите кадровое действие", "Confirm employment action")}</p>
            <div className="app-surface app-border mt-4 grid gap-2 rounded-xl border p-3 text-sm">
              <SummaryRow
                label={text("Новый руководитель", "New leader")}
                value={selectedCandidate ? employeeName(selectedCandidate, text) : text("Не назначен", "Not assigned")}
              />
              {selectedCandidate && (
                <SummaryRow label={text("Назначение", "Assignment")} value={fixedPositionLabel} />
              )}
              {currentLeaderId && (
                <SummaryRow
                  label={text("Прежний руководитель", "Previous leader")}
                  value={previousOutcomeLabel(previousForm.outcome, text)}
                />
              )}
              <SummaryRow label={text("Дата", "Date")} value={changeForm.effectiveAt} />
              <SummaryRow label={text("Основание", "Reason")} value={changeForm.reason.trim()} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <ActionButton
              action="back"
              disabled={loading}
              onClick={() => setConfirming(false)}
              type="button"
            />
            <ActionButton
              action="confirm"
              loading={loading}
              onClick={() => void save()}
              type="button"
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <Field label={text("Новый руководитель", "New leader")}>
            <SearchableSelect
              allowEmpty
              ariaLabel={text("Новый руководитель", "New leader")}
              emptyOptionLabel={text("Не назначен", "Not assigned")}
              noOptionsLabel={text("Активные сотрудники не найдены", "No active employees found")}
              onValueChange={selectCandidate}
              options={options}
              placeholder={text("Выберите сотрудника", "Select employee")}
              searchPlaceholder={text("Поиск по ФИО, предприятию, отделу или должности", "Search by name, enterprise, department, or position")}
              value={leaderId}
            />
          </Field>

          {selectedCandidate && !selectedAlreadyLeads && (
            <div className="grid gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
              <div>
                <p className="app-text text-sm font-black">{text("Новое назначение", "New assignment")}</p>
                <p className="app-muted mt-1 text-xs leading-5">
                  {text("Обычная должность прекращается, руководящая роль фиксируется отдельным кадровым событием.", "The regular position ends and the leadership role is recorded as a separate employment event.")}
                </p>
              </div>
              <div className="app-surface app-border rounded-xl border p-3">
                <p className="app-muted text-xs font-bold uppercase tracking-wide">{text("Роль", "Role")}</p>
                <p className="app-text mt-1 font-black">{fixedPositionLabel}</p>
              </div>
              <Field label={text("Оклад нового руководителя", "New leader salary")}>
                <Input
                  min="0"
                  onChange={(event) =>
                    setChangeForm((value) => ({ ...value, salary: event.target.value }))
                  }
                  step="0.01"
                  type="number"
                  value={changeForm.salary}
                />
              </Field>
            </div>
          )}

          {currentLeaderId && !selectedAlreadyLeads && (
            <div className="app-surface-muted app-border grid gap-4 rounded-2xl border p-4">
              <div>
                <p className="app-text text-sm font-black">{text("Что сделать с прежним руководителем?", "What should happen to the previous leader?")}</p>
                <p className="app-muted mt-1 text-xs leading-5">
                  {currentLeader ? employeeName(currentLeader, text) : text("Текущий руководитель", "Current leader")} {text("не будет потерян из кадровой истории.", "will remain in employment history.")}
                </p>
              </div>
              <SearchableSelect
                ariaLabel={text("Действие для прежнего руководителя", "Action for previous leader")}
                onValueChange={(value) =>
                  setPreviousForm((current) => ({
                    ...current,
                    outcome: value as PreviousLeaderOutcome,
                  }))
                }
                options={previousOutcomeOptions}
                value={previousForm.outcome}
              />

              {previousForm.outcome !== "unassigned" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={text("Отдел", "Department")}>
                    <SearchableSelect
                      ariaLabel={text("Отдел прежнего руководителя", "Previous leader department")}
                      onValueChange={(value) =>
                        setPreviousForm((current) => ({
                          ...current,
                          departmentId: value,
                          positionId: "",
                        }))
                      }
                      options={departmentOptions}
                      placeholder={text("Выберите отдел", "Select department")}
                      value={previousForm.departmentId}
                    />
                  </Field>
                  <Field label={text("Должность", "Position")}>
                    <SearchableSelect
                      ariaLabel={text("Должность прежнего руководителя", "Previous leader position")}
                      onValueChange={(value) =>
                        setPreviousForm((current) => ({ ...current, positionId: value }))
                      }
                      options={previousPositionOptions}
                      placeholder={text("Выберите должность", "Select position")}
                      value={previousForm.positionId}
                    />
                  </Field>
                  <Field label={text("Оклад", "Salary")}>
                    <Input
                      min="0"
                      onChange={(event) =>
                        setPreviousForm((current) => ({ ...current, salary: event.target.value }))
                      }
                      step="0.01"
                      type="number"
                      value={previousForm.salary}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {isChangingLeadership && (
            <div className="grid gap-4">
              <Field label={text("Дата вступления в силу", "Effective date")}>
                <Input
                  disabled={!canChangeEmployment}
                  onChange={(event) =>
                    setChangeForm((value) => ({ ...value, effectiveAt: event.target.value }))
                  }
                  required
                  type="date"
                  value={changeForm.effectiveAt}
                />
              </Field>
              <Field label={text("Основание кадрового изменения", "Employment change reason")}>
                <Textarea
                  disabled={!canChangeEmployment}
                  onChange={(event) =>
                    setChangeForm((value) => ({ ...value, reason: event.target.value }))
                  }
                  placeholder={text("Например: приказ №12 от 25.08.2026", "For example: order #12 dated 25.08.2026")}
                  required
                  rows={3}
                  value={changeForm.reason}
                />
              </Field>
            </div>
          )}

          {selectedAlreadyLeads && (
            <div className="app-accent-soft app-border rounded-2xl border p-4 text-sm font-semibold">
              {text("Этот сотрудник уже является текущим руководителем. Выберите другого сотрудника для замены или «Не назначен», чтобы снять назначение.", "This employee is already the current leader. Select another employee to replace them or choose Not assigned to remove the assignment.")}
            </div>
          )}

          {!canChangeEmployment && isChangingLeadership && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
              {text("Для этого действия требуется разрешение «Кадровые изменения».", "This action requires the Employment changes permission.")}
            </div>
          )}

          {mode === "enterprise" && targetDepartments.length === 0 && leaderId && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
              {text("В предприятии пока нет отделов. Сначала создайте хотя бы один отдел.", "There are no departments in the enterprise yet. Create at least one department first.")}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <ActionButton
              action="cancel"
              onClick={() => onOpenChange(false)}
              type="button"
            />
            <ActionButton
              action={selectedAlreadyLeads || (!leaderId && !currentLeaderId) ? "close" : "confirm"}
              disabled={isChangingLeadership && !canChangeEmployment}
              loading={loading}
              onClick={requestSave}
              type="button"
            >
              {selectedAlreadyLeads
                ? text("Закрыть", "Close")
                : leaderId
                  ? currentLeaderId
                    ? text("Заменить руководителя", "Replace leader")
                    : text("Назначить руководителя", "Assign leader")
                  : currentLeaderId
                    ? text("Снять руководителя", "Remove leader")
                    : text("Закрыть", "Close")}
            </ActionButton>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-black">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:gap-3">
      <span className="app-muted font-semibold">{label}</span>
      <span className="app-text font-bold">{value}</span>
    </div>
  );
}

function createLeadershipChangeForm(candidate?: HrRecord): LeadershipChangeForm {
  return {
    effectiveAt: localDateValue(),
    reason: "",
    salary: String(candidate?.salary ?? 0),
  };
}

function createPreviousLeaderForm(candidate?: HrRecord): PreviousLeaderForm {
  return {
    outcome: "unassigned",
    departmentId: String(positiveId(candidate?.department_id) ?? ""),
    positionId: String(positiveId(candidate?.position_id) ?? ""),
    salary: String(candidate?.salary ?? 0),
  };
}

function resolveTargetDepartmentId(
  candidate: HrRecord,
  mode: LeadershipMode,
  departmentId: number | null,
  departments: HrRecord[],
): number | null {
  if (mode === "department") return departmentId;
  const currentDepartmentId = positiveId(candidate.department_id);
  if (
    currentDepartmentId &&
    departments.some((department) => Number(department.id) === currentDepartmentId)
  ) {
    return currentDepartmentId;
  }
  return positiveId(departments[0]?.id);
}

async function loadActiveEmployees(): Promise<HrRecord[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await hrApiClient.list({
      entity: "employees",
      filters: { lifecycle_status: "active" },
      orderBy: "last_name",
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

function candidateLabel(
  candidate: HrRecord,
  text: (ru: string, en: string) => string,
): string {
  const name = employeeName(candidate, text);
  const assignment = [
    candidate.enterprise_name,
    candidate.department_name,
    candidate.position_name,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" · ");
  return assignment ? `${name} — ${assignment}` : text(`${name} — без назначения`, `${name} — unassigned`);
}

function employeeName(
  record: HrRecord,
  text: (ru: string, en: string) => string,
): string {
  return (
    [record.last_name, record.first_name, record.middle_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ") || text("Сотрудник", "Employee")
  );
}

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousOutcomeLabel(
  value: PreviousLeaderOutcome,
  text: (ru: string, en: string) => string,
): string {
  if (value === "assign_position") {
    return text("Назначить на обычную должность", "Assign to a regular position");
  }
  if (value === "transfer") {
    return text("Перевести на другое назначение", "Transfer to another assignment");
  }
  return text("Временно оставить без должности", "Temporarily leave without a position");
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
