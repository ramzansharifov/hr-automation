import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord } from "../../shared/types/hr";
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
}: DepartmentLeaderDialogProps): JSX.Element {
  const [candidates, setCandidates] = useState<HrRecord[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [changeForm, setChangeForm] = useState<LeadershipChangeForm>(() =>
    createLeadershipChangeForm(),
  );

  const targetDepartments = useMemo(
    () =>
      departments.filter(
        (item) => Number(item.enterprise_id) === enterpriseId,
      ),
    [departments, enterpriseId],
  );

  useEffect(() => {
    if (!open) {
      setCandidates([]);
      setLeaderId("");
      setConfirming(false);
      setChangeForm(createLeadershipChangeForm());
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
        const currentLeader = records.find(
          (record) => String(record.id) === currentValue,
        );
        setChangeForm(createLeadershipChangeForm(currentLeader));
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

  const selectedCandidate = candidates.find(
    (candidate) => String(candidate.id) === leaderId,
  );
  const selectedAlreadyLeads =
    Boolean(currentLeaderId) && leaderId === String(currentLeaderId);
  const leadershipTitle =
    mode === "enterprise" ? "директором предприятия" : "руководителем отдела";
  const fixedPositionLabel =
    mode === "enterprise"
      ? `Директор предприятия — ${enterpriseName}`
      : `Руководитель отдела — ${departmentName}`;
  const canAssignEnterpriseLeader =
    mode !== "enterprise" || targetDepartments.length > 0;

  function selectCandidate(value: string): void {
    setLeaderId(value);
    setConfirming(false);
    const candidate = candidates.find((record) => String(record.id) === value);
    setChangeForm(createLeadershipChangeForm(candidate));
  }

  function requestSave(): void {
    if (loading) return;
    if (selectedAlreadyLeads) {
      onOpenChange(false);
      return;
    }

    if (leaderId) {
      if (!selectedCandidate) {
        toast.error("Выберите сотрудника");
        return;
      }
      if (!canChangeEmployment) {
        toast.error(
          "Назначение руководителя является кадровым изменением. Требуется разрешение «Кадровые изменения»",
        );
        return;
      }
      if (!canAssignEnterpriseLeader) {
        toast.error(
          "Для назначения директора предприятия в предприятии должен быть создан хотя бы один отдел",
        );
        return;
      }

      const salary = Number(changeForm.salary);
      if (
        !changeForm.salary.trim() ||
        !Number.isFinite(salary) ||
        salary < 0
      ) {
        toast.error("Укажите корректный оклад");
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
    } else if (!currentLeaderId) {
      onOpenChange(false);
      return;
    }

    setConfirming(true);
  }

  async function save(): Promise<void> {
    if (loading) return;

    if (!leaderId) {
      setLoading(true);
      try {
        await hrApiClient.update({
          entity: mode === "enterprise" ? "enterprises" : "departments",
          id: mode === "enterprise" ? enterpriseId : departmentId!,
          data:
            mode === "enterprise"
              ? { general_director_employee_id: null }
              : { director_employee_id: null },
        });
        toast.success(
          mode === "enterprise"
            ? "Директор предприятия снят с назначения"
            : "Руководитель отдела снят с назначения",
        );
        onSaved();
        onOpenChange(false);
      } catch (error) {
        toast.error(errorMessage(error, "Не удалось снять руководителя"));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedCandidate || !canChangeEmployment) return;

    const targetDepartmentId = resolveTargetDepartmentId(
      selectedCandidate,
      mode,
      departmentId,
      targetDepartments,
    );
    if (!targetDepartmentId) {
      toast.error(
        "Для назначения директора предприятия в предприятии должен быть создан хотя бы один отдел",
      );
      setConfirming(false);
      return;
    }

    const salary = Number(changeForm.salary);
    if (!Number.isFinite(salary) || salary < 0) {
      toast.error("Укажите корректный оклад");
      setConfirming(false);
      return;
    }

    setLoading(true);
    try {
      await hrApiClient.changeEmployment({
        employeeId: Number(selectedCandidate.id),
        enterpriseId,
        departmentId: targetDepartmentId,
        positionId: null,
        salaryMode: "custom",
        salary,
        effectiveAt: changeForm.effectiveAt,
        reason: changeForm.reason.trim(),
        leadershipAssignment: {
          type:
            mode === "enterprise" ? "enterprise_director" : "department_head",
          targetId: mode === "enterprise" ? enterpriseId : departmentId!,
        },
      });

      toast.success(
        mode === "enterprise"
          ? "Сотрудник назначен директором предприятия"
          : "Сотрудник назначен руководителем отдела",
      );
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          mode === "enterprise"
            ? "Не удалось назначить директора предприятия"
            : "Не удалось назначить руководителя отдела",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      description={
        confirming
          ? "Проверьте условия и подтвердите кадровое изменение."
          : `Выберите активного сотрудника и оформите назначение ${leadershipTitle} как кадровое изменение.`
      }
      onOpenChange={onOpenChange}
      open={open}
      title={
        mode === "enterprise"
          ? "Назначить директора предприятия"
          : "Назначить руководителя отдела"
      }
    >
      {loading && candidates.length === 0 ? (
        <LoadingState label="Загрузка сотрудников..." />
      ) : confirming ? (
        <div className="grid gap-5">
          {leaderId && selectedCandidate ? (
            <>
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
                <p className="app-text text-base font-black">
                  Вы уверены, что хотите произвести это кадровое изменение?
                </p>
                <p className="app-muted mt-3 text-sm leading-6">
                  Сотрудник <strong className="app-text">{employeeName(selectedCandidate)}</strong>{" "}
                  перестанет занимать текущую обычную должность и получит фиксированное назначение:
                </p>
                <p className="app-text mt-2 font-black">{fixedPositionLabel}</p>
                <div className="app-surface app-border mt-4 grid gap-2 rounded-xl border p-3 text-sm">
                  <SummaryRow label="Оклад" value={formatSalary(changeForm.salary)} />
                  <SummaryRow label="Дата вступления в силу" value={changeForm.effectiveAt} />
                  <SummaryRow label="Основание" value={changeForm.reason.trim()} />
                </div>
                <p className="app-muted mt-3 text-xs leading-5">
                  Предыдущее кадровое назначение: {assignmentLabel(selectedCandidate)}.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  disabled={loading}
                  onClick={() => setConfirming(false)}
                  type="button"
                  variant="secondary"
                >
                  Назад
                </Button>
                <Button disabled={loading} onClick={() => void save()} type="button">
                  Подтвердить назначение
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
                <p className="app-text text-base font-black">
                  Вы уверены, что хотите снять текущего руководителя?
                </p>
                <p className="app-muted mt-2 text-sm leading-6">
                  Назначение будет снято. Карточка сотрудника и кадровая история останутся в системе.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  disabled={loading}
                  onClick={() => setConfirming(false)}
                  type="button"
                  variant="secondary"
                >
                  Назад
                </Button>
                <Button disabled={loading} onClick={() => void save()} type="button">
                  Да, снять
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-5">
          <Field label="Сотрудник">
            <SearchableSelect
              allowEmpty
              ariaLabel="Сотрудник"
              emptyOptionLabel="Не назначен"
              noOptionsLabel="Активные сотрудники не найдены"
              onValueChange={selectCandidate}
              options={options}
              placeholder="Выберите сотрудника"
              searchPlaceholder="Поиск по ФИО, предприятию, отделу или должности"
              value={leaderId}
            />
          </Field>

          {selectedCandidate && (
            <div className="app-surface-muted app-border rounded-2xl border p-4 text-sm">
              <p className="app-text font-black">Текущее кадровое назначение</p>
              <p className="app-muted mt-1 leading-6">
                {assignmentLabel(selectedCandidate)}
              </p>
            </div>
          )}

          {selectedAlreadyLeads && (
            <div className="app-accent-soft app-border rounded-2xl border p-4 text-sm font-semibold">
              Этот сотрудник уже является текущим руководителем. Выберите другого сотрудника для замены или «Не назначен», чтобы снять назначение.
            </div>
          )}

          {selectedCandidate && !selectedAlreadyLeads && (
            <div className="grid gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
              <div>
                <p className="app-text text-sm font-black">Новое кадровое назначение</p>
                <p className="app-muted mt-1 text-xs leading-5">
                  Должность задаётся системой и не редактируется. Предыдущее обычное назначение сотрудника будет прекращено автоматически.
                </p>
              </div>

              <div className="app-surface app-border rounded-xl border p-3">
                <p className="app-muted text-xs font-bold uppercase tracking-wide">
                  Новая должность
                </p>
                <p className="app-text mt-1 font-black">{fixedPositionLabel}</p>
              </div>

              <Field label="Оклад">
                <Input
                  disabled={!canChangeEmployment}
                  min="0"
                  onChange={(event) =>
                    setChangeForm((value) => ({
                      ...value,
                      salary: event.target.value,
                    }))
                  }
                  required
                  step="0.01"
                  type="number"
                  value={changeForm.salary}
                />
              </Field>

              <Field label="Дата вступления в силу">
                <Input
                  disabled={!canChangeEmployment}
                  onChange={(event) =>
                    setChangeForm((value) => ({
                      ...value,
                      effectiveAt: event.target.value,
                    }))
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
                    setChangeForm((value) => ({
                      ...value,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Например: приказ №12 от 25.08.2026"
                  required
                  rows={3}
                  value={changeForm.reason}
                />
              </Field>
            </div>
          )}

          {!canChangeEmployment && leaderId && !selectedAlreadyLeads && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
              Для назначения руководителя требуется разрешение «Кадровые изменения».
            </div>
          )}

          {mode === "enterprise" && targetDepartments.length === 0 && leaderId && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
              В предприятии пока нет отделов. Сначала создайте хотя бы один отдел, чтобы система могла оформить кадровое назначение директора.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Отмена
            </Button>
            <Button
              disabled={
                loading ||
                Boolean(
                  leaderId &&
                    !selectedAlreadyLeads &&
                    (!canChangeEmployment || !canAssignEnterpriseLeader),
                )
              }
              onClick={requestSave}
              type="button"
            >
              {selectedAlreadyLeads
                ? "Закрыть"
                : leaderId
                  ? mode === "enterprise"
                    ? "Назначить директором"
                    : "Назначить руководителем"
                  : "Снять руководителя"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
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
      filters: { status: "active" },
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

function assignmentLabel(candidate: HrRecord): string {
  return (
    [candidate.enterprise_name, candidate.department_name, candidate.position_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" → ") || "Предприятие, отдел и должность ещё не назначены"
  );
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

function formatSalary(value: string): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("ru-RU") : value;
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
