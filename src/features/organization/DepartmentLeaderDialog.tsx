import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord, PreviousLeaderOutcome } from "../../shared/types/hr";
import {
  Button,
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
        toast.error(errorMessage(error, "Не удалось загрузить сотрудников"));
        onOpenChange(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentLeaderId, onOpenChange, open]);

  const options = useMemo<SelectOption[]>(
    () =>
      candidates.map((candidate) => ({
        value: String(candidate.id),
        label: candidateLabel(candidate),
      })),
    [candidates],
  );

  const departmentOptions = useMemo<SelectOption[]>(
    () =>
      targetDepartments.map((department) => ({
        value: String(department.id),
        label: String(department.name ?? "Отдел"),
      })),
    [targetDepartments],
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
        label: String(position.name ?? "Должность"),
      }));
  }, [positions, previousForm.departmentId]);

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
    mode === "enterprise" ? "директором предприятия" : "руководителем отдела";
  const fixedPositionLabel =
    mode === "enterprise"
      ? `Директор предприятия — ${enterpriseName}`
      : `Руководитель отдела — ${departmentName}`;
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
        "Назначение, замена и снятие руководителя являются кадровыми изменениями. Требуется разрешение «Кадровые изменения»",
      );
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(changeForm.effectiveAt)) {
      toast.error("Укажите дату вступления кадрового изменения в силу");
      return;
    }
    if (!changeForm.reason.trim()) {
      toast.error("Укажите основание кадрового изменения");
      return;
    }

    if (leaderId) {
      if (!selectedCandidate) {
        toast.error("Выберите сотрудника");
        return;
      }
      if (!canAssignEnterpriseLeader) {
        toast.error(
          "Для назначения директора предприятия в предприятии должен быть создан хотя бы один отдел",
        );
        return;
      }
      const salary = Number(changeForm.salary);
      if (!changeForm.salary.trim() || !Number.isFinite(salary) || salary < 0) {
        toast.error("Укажите корректный оклад нового руководителя");
        return;
      }
    }

    if (currentLeaderId && previousForm.outcome !== "unassigned") {
      const previousDepartmentId = positiveId(previousForm.departmentId);
      const previousPositionId = positiveId(previousForm.positionId);
      const salary = Number(previousForm.salary);
      if (!previousDepartmentId || !previousPositionId) {
        toast.error("Выберите отдел и должность для прежнего руководителя");
        return;
      }
      if (!Number.isFinite(salary) || salary < 0) {
        toast.error("Укажите корректный оклад прежнего руководителя");
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
        "Для назначения директора предприятия в предприятии должен быть создан хотя бы один отдел",
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
            ? "Руководитель заменён, кадровая история сохранена"
            : mode === "enterprise"
              ? "Сотрудник назначен директором предприятия"
              : "Сотрудник назначен руководителем отдела"
          : "Руководитель снят, кадровая история сохранена",
      );
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось выполнить кадровое изменение руководителя"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      description={
        confirming
          ? "Проверьте условия и подтвердите единое кадровое действие."
          : `Назначение, замена и снятие ${leadershipTitle} фиксируются в кадровой истории.`
      }
      onOpenChange={onOpenChange}
      open={open}
      title={
        mode === "enterprise"
          ? "Управление директором предприятия"
          : "Управление руководителем отдела"
      }
    >
      {loading && candidates.length === 0 ? (
        <LoadingState label="Загрузка сотрудников..." />
      ) : confirming ? (
        <div className="grid gap-5">
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
            <p className="app-text text-base font-black">Подтвердите кадровое действие</p>
            <div className="app-surface app-border mt-4 grid gap-2 rounded-xl border p-3 text-sm">
              <SummaryRow
                label="Новый руководитель"
                value={selectedCandidate ? employeeName(selectedCandidate) : "Не назначен"}
              />
              {selectedCandidate && (
                <SummaryRow label="Назначение" value={fixedPositionLabel} />
              )}
              {currentLeaderId && (
                <SummaryRow
                  label="Прежний руководитель"
                  value={previousOutcomeLabel(previousForm.outcome)}
                />
              )}
              <SummaryRow label="Дата" value={changeForm.effectiveAt} />
              <SummaryRow label="Основание" value={changeForm.reason.trim()} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button disabled={loading} onClick={() => setConfirming(false)} type="button" variant="secondary">
              Назад
            </Button>
            <Button disabled={loading} onClick={() => void save()} type="button">
              Подтвердить
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <Field label="Новый руководитель">
            <SearchableSelect
              allowEmpty
              ariaLabel="Новый руководитель"
              emptyOptionLabel="Не назначен"
              noOptionsLabel="Активные сотрудники не найдены"
              onValueChange={selectCandidate}
              options={options}
              placeholder="Выберите сотрудника"
              searchPlaceholder="Поиск по ФИО, предприятию, отделу или должности"
              value={leaderId}
            />
          </Field>

          {selectedCandidate && !selectedAlreadyLeads && (
            <div className="grid gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
              <div>
                <p className="app-text text-sm font-black">Новое назначение</p>
                <p className="app-muted mt-1 text-xs leading-5">
                  Обычная должность прекращается, руководящая роль фиксируется отдельным кадровым событием.
                </p>
              </div>
              <div className="app-surface app-border rounded-xl border p-3">
                <p className="app-muted text-xs font-bold uppercase tracking-wide">Роль</p>
                <p className="app-text mt-1 font-black">{fixedPositionLabel}</p>
              </div>
              <Field label="Оклад нового руководителя">
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
                <p className="app-text text-sm font-black">Что сделать с прежним руководителем?</p>
                <p className="app-muted mt-1 text-xs leading-5">
                  {currentLeader ? employeeName(currentLeader) : "Текущий руководитель"} не будет потерян из кадровой истории.
                </p>
              </div>
              <SearchableSelect
                ariaLabel="Действие для прежнего руководителя"
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
                  <Field label="Отдел">
                    <SearchableSelect
                      ariaLabel="Отдел прежнего руководителя"
                      onValueChange={(value) =>
                        setPreviousForm((current) => ({
                          ...current,
                          departmentId: value,
                          positionId: "",
                        }))
                      }
                      options={departmentOptions}
                      placeholder="Выберите отдел"
                      value={previousForm.departmentId}
                    />
                  </Field>
                  <Field label="Должность">
                    <SearchableSelect
                      ariaLabel="Должность прежнего руководителя"
                      onValueChange={(value) =>
                        setPreviousForm((current) => ({ ...current, positionId: value }))
                      }
                      options={previousPositionOptions}
                      placeholder="Выберите должность"
                      value={previousForm.positionId}
                    />
                  </Field>
                  <Field label="Оклад">
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
              <Field label="Дата вступления в силу">
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
              <Field label="Основание кадрового изменения">
                <Textarea
                  disabled={!canChangeEmployment}
                  onChange={(event) =>
                    setChangeForm((value) => ({ ...value, reason: event.target.value }))
                  }
                  placeholder="Например: приказ №12 от 25.08.2026"
                  required
                  rows={3}
                  value={changeForm.reason}
                />
              </Field>
            </div>
          )}

          {selectedAlreadyLeads && (
            <div className="app-accent-soft app-border rounded-2xl border p-4 text-sm font-semibold">
              Этот сотрудник уже является текущим руководителем. Выберите другого сотрудника для замены или «Не назначен», чтобы снять назначение.
            </div>
          )}

          {!canChangeEmployment && isChangingLeadership && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
              Для этого действия требуется разрешение «Кадровые изменения».
            </div>
          )}

          {mode === "enterprise" && targetDepartments.length === 0 && leaderId && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
              В предприятии пока нет отделов. Сначала создайте хотя бы один отдел.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
              Отмена
            </Button>
            <Button
              disabled={loading || (isChangingLeadership && !canChangeEmployment)}
              onClick={requestSave}
              type="button"
            >
              {selectedAlreadyLeads
                ? "Закрыть"
                : leaderId
                  ? currentLeaderId
                    ? "Заменить руководителя"
                    : "Назначить руководителя"
                  : currentLeaderId
                    ? "Снять руководителя"
                    : "Закрыть"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

const previousOutcomeOptions: SelectOption[] = [
  { value: "unassigned", label: "Временно оставить без должности" },
  { value: "assign_position", label: "Назначить на обычную должность" },
  { value: "transfer", label: "Перевести в другой отдел / на другую должность" },
];

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

function candidateLabel(candidate: HrRecord): string {
  const name = employeeName(candidate);
  const assignment = [
    candidate.enterprise_name,
    candidate.department_name,
    candidate.position_name,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" · ");
  return assignment ? `${name} — ${assignment}` : `${name} — без назначения`;
}

function employeeName(record: HrRecord): string {
  return (
    [record.last_name, record.first_name, record.middle_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ") || "Сотрудник"
  );
}

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousOutcomeLabel(value: PreviousLeaderOutcome): string {
  if (value === "assign_position") return "Назначить на обычную должность";
  if (value === "transfer") return "Перевести на другое назначение";
  return "Временно оставить без должности";
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
