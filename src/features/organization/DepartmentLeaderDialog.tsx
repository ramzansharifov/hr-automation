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
  Select,
  Textarea,
  type SelectOption,
} from "../../shared/ui";

interface DepartmentLeaderDialogProps {
  canChangeEmployment: boolean;
  currentLeaderId: number | null;
  departmentId: number;
  departmentName: string;
  enterpriseId: number;
  enterpriseName: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  open: boolean;
  positions: HrRecord[];
}

export function DepartmentLeaderDialog({
  canChangeEmployment,
  currentLeaderId,
  departmentId,
  departmentName,
  enterpriseId,
  enterpriseName,
  onOpenChange,
  onSaved,
  open,
  positions,
}: DepartmentLeaderDialogProps): JSX.Element {
  const [candidates, setCandidates] = useState<HrRecord[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [career, setCareer] = useState(() => initialCareer());

  useEffect(() => {
    if (!open) {
      setCandidates([]);
      setLeaderId("");
      setCareer(initialCareer());
      return;
    }

    let active = true;
    setLoading(true);
    void loadActiveEmployees()
      .then((records) => {
        if (!active) return;
        setCandidates(records);
        const currentValue = currentLeaderId ? String(currentLeaderId) : "";
        setLeaderId(currentValue);
        const current = records.find(
          (record) => String(record.id) === currentValue,
        );
        if (current) setCareer(careerFromCandidate(current, departmentId, positions));
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
  }, [currentLeaderId, departmentId, onOpenChange, open, positions]);

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
  const selectedIsUnassigned = Boolean(
    selectedCandidate &&
      !positiveId(selectedCandidate.department_id) &&
      !positiveId(selectedCandidate.position_id),
  );
  const selectedAlreadyLeads =
    Boolean(currentLeaderId) && leaderId === String(currentLeaderId);
  const needsCareerWorkflow = Boolean(
    selectedCandidate && !selectedIsUnassigned && !selectedAlreadyLeads,
  );
  const availablePositions = positions.map((position) => ({
    value: String(position.id),
    label: String(position.name ?? "Должность"),
  }));

  function selectCandidate(value: string): void {
    setLeaderId(value);
    const candidate = candidates.find((record) => String(record.id) === value);
    setCareer(
      candidate
        ? careerFromCandidate(candidate, departmentId, positions)
        : initialCareer(),
    );
  }

  async function save(): Promise<void> {
    if (loading) return;
    if (!leaderId) {
      setLoading(true);
      try {
        await hrApiClient.update({
          entity: "departments",
          id: departmentId,
          data: { director_employee_id: null },
        });
        toast.success("Руководитель отдела снят с назначения");
        onSaved();
        onOpenChange(false);
      } catch (error) {
        toast.error(errorMessage(error, "Не удалось снять руководителя"));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedCandidate) {
      toast.error("Выберите сотрудника");
      return;
    }
    if (selectedAlreadyLeads) {
      onOpenChange(false);
      return;
    }
    if (needsCareerWorkflow && !canChangeEmployment) {
      toast.error(
        "У сотрудника уже есть организационное назначение. Для его перевода требуется право на кадровые изменения",
      );
      return;
    }
    if (needsCareerWorkflow && !career.reason.trim()) {
      toast.error("Укажите основание кадрового изменения");
      return;
    }

    setLoading(true);
    try {
      const reason = needsCareerWorkflow
        ? career.reason.trim()
        : `Назначение руководителем отдела «${departmentName}»`;
      await hrApiClient.changeEmployment({
        employeeId: Number(selectedCandidate.id),
        enterpriseId,
        departmentId,
        positionId: career.positionId ? Number(career.positionId) : null,
        salaryMode: career.salaryMode as "keep" | "custom",
        salary:
          career.salaryMode === "custom" ? Number(career.salary) : undefined,
        effectiveAt: needsCareerWorkflow
          ? career.effectiveAt
          : new Date().toISOString().slice(0, 10),
        reason,
        assignAsDepartmentLeader: true,
      });
      toast.success(
        needsCareerWorkflow
          ? "Кадровое изменение и назначение руководителя сохранены"
          : "Руководитель отдела назначен",
      );
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось назначить руководителя отдела"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      description="Свободного сотрудника можно назначить сразу. Если сотрудник уже относится к отделу или занимает должность, назначение оформляется как кадровое изменение."
      onOpenChange={onOpenChange}
      open={open}
      title="Назначить руководителя отдела"
    >
      {loading && candidates.length === 0 ? (
        <LoadingState label="Загрузка сотрудников..." />
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
              <p className="app-text font-black">Текущее назначение</p>
              <p className="app-muted mt-1 leading-6">
                {assignmentLabel(selectedCandidate)}
              </p>
            </div>
          )}

          {selectedCandidate && selectedIsUnassigned && !selectedAlreadyLeads && (
            <div className="border-emerald-500/25 bg-emerald-500/10 rounded-2xl border p-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              У сотрудника ещё нет предприятия, отдела и должности. Он будет сразу привязан к отделу «{departmentName}» и назначен его руководителем.
            </div>
          )}

          {needsCareerWorkflow && (
            <div className="grid gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
              <div>
                <p className="app-text text-sm font-black">Кадровое изменение</p>
                <p className="app-muted mt-1 text-xs leading-5">
                  Сотрудник будет переведён в {enterpriseName} → {departmentName}. Можно сохранить подходящую должность этого отдела или оставить только руководящую роль.
                </p>
              </div>

              {!canChangeEmployment && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Для такого назначения дополнительно требуется разрешение «Кадровые изменения».
                </div>
              )}

              <Field label="Должность после изменения">
                <SearchableSelect
                  allowEmpty
                  disabled={!canChangeEmployment}
                  emptyOptionLabel="Без отдельной должности"
                  onValueChange={(positionId) =>
                    setCareer((value) => ({ ...value, positionId }))
                  }
                  options={availablePositions}
                  placeholder="Без отдельной должности"
                  searchPlaceholder="Поиск должности"
                  value={career.positionId}
                />
              </Field>

              <Field label="Оклад">
                <Select
                  disabled={!canChangeEmployment}
                  onValueChange={(salaryMode) =>
                    setCareer((value) => ({ ...value, salaryMode }))
                  }
                  options={[
                    { value: "keep", label: "Оставить без изменений" },
                    { value: "custom", label: "Указать новый оклад" },
                  ]}
                  value={career.salaryMode}
                />
              </Field>

              {career.salaryMode === "custom" && (
                <Field label="Новый оклад">
                  <Input
                    disabled={!canChangeEmployment}
                    min="0"
                    onChange={(event) =>
                      setCareer((value) => ({
                        ...value,
                        salary: event.target.value,
                      }))
                    }
                    type="number"
                    value={career.salary}
                  />
                </Field>
              )}

              <Field label="Дата вступления в силу">
                <Input
                  disabled={!canChangeEmployment}
                  onChange={(event) =>
                    setCareer((value) => ({
                      ...value,
                      effectiveAt: event.target.value,
                    }))
                  }
                  required
                  type="date"
                  value={career.effectiveAt}
                />
              </Field>

              <Field label="Основание">
                <Textarea
                  disabled={!canChangeEmployment}
                  onChange={(event) =>
                    setCareer((value) => ({ ...value, reason: event.target.value }))
                  }
                  placeholder="Например: перевод и назначение руководителем по приказу №..."
                  required
                  rows={3}
                  value={career.reason}
                />
              </Field>
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
                (needsCareerWorkflow && !canChangeEmployment)
              }
              onClick={() => void save()}
            >
              {needsCareerWorkflow
                ? "Сохранить кадровое изменение"
                : leaderId
                  ? "Назначить руководителя"
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

function initialCareer(): {
  positionId: string;
  salaryMode: string;
  salary: string;
  effectiveAt: string;
  reason: string;
} {
  return {
    positionId: "",
    salaryMode: "keep",
    salary: "0",
    effectiveAt: new Date().toISOString().slice(0, 10),
    reason: "",
  };
}

function careerFromCandidate(
  candidate: HrRecord,
  departmentId: number,
  positions: HrRecord[],
): ReturnType<typeof initialCareer> {
  const candidatePositionId = positiveId(candidate.position_id);
  const canKeepPosition =
    positiveId(candidate.department_id) === departmentId &&
    candidatePositionId !== null &&
    positions.some((position) => positiveId(position.id) === candidatePositionId);
  return {
    ...initialCareer(),
    positionId: canKeepPosition ? String(candidatePositionId) : "",
    salary: String(candidate.salary ?? 0),
  };
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

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
