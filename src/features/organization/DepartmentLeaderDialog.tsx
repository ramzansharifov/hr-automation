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

interface CareerState {
  departmentId: string;
  positionId: string;
  salaryMode: "keep" | "custom";
  salary: string;
  effectiveAt: string;
  reason: string;
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
  const [career, setCareer] = useState<CareerState>(() => initialCareer());

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
        setCareer(
          current
            ? careerFromCandidate(
                current,
                mode,
                departmentId,
                targetDepartments,
                positions,
              )
            : initialCareerForTarget(mode, departmentId, targetDepartments),
        );
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
  }, [
    currentLeaderId,
    departmentId,
    mode,
    onOpenChange,
    open,
    positions,
    targetDepartments,
  ]);

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
  const departmentOptions = useMemo<SelectOption[]>(
    () =>
      targetDepartments.map((item) => ({
        value: String(item.id),
        label: String(item.name ?? "Отдел"),
      })),
    [targetDepartments],
  );
  const availablePositions = useMemo<SelectOption[]>(
    () =>
      positions
        .filter(
          (position) => String(position.department_id ?? "") === career.departmentId,
        )
        .map((position) => ({
          value: String(position.id),
          label: String(position.name ?? "Должность"),
        })),
    [career.departmentId, positions],
  );

  const leadershipLabel =
    mode === "enterprise" ? "руководителем предприятия" : "руководителем отдела";
  const targetName = mode === "enterprise" ? enterpriseName : departmentName;

  function selectCandidate(value: string): void {
    setLeaderId(value);
    const candidate = candidates.find((record) => String(record.id) === value);
    setCareer(
      candidate
        ? careerFromCandidate(
            candidate,
            mode,
            departmentId,
            targetDepartments,
            positions,
          )
        : initialCareerForTarget(mode, departmentId, targetDepartments),
    );
  }

  function changeDepartment(nextDepartmentId: string): void {
    setCareer((current) => ({
      ...current,
      departmentId: nextDepartmentId,
      positionId: positionBelongsToDepartment(
        current.positionId,
        nextDepartmentId,
        positions,
      )
        ? current.positionId
        : "",
    }));
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
            ? "Руководитель предприятия снят с назначения"
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

    if (!selectedCandidate) {
      toast.error("Выберите сотрудника");
      return;
    }
    if (selectedAlreadyLeads) {
      onOpenChange(false);
      return;
    }
    if (!canChangeEmployment) {
      toast.error(
        "Назначение руководителя является кадровым изменением. Требуется разрешение «Кадровые изменения»",
      );
      return;
    }
    if (!career.departmentId) {
      toast.error("Выберите отдел сотрудника после кадрового изменения");
      return;
    }
    if (!career.effectiveAt) {
      toast.error("Укажите дату вступления кадрового изменения в силу");
      return;
    }
    if (!career.reason.trim()) {
      toast.error("Укажите основание кадрового изменения");
      return;
    }

    setLoading(true);
    try {
      await hrApiClient.changeEmployment({
        employeeId: Number(selectedCandidate.id),
        enterpriseId,
        departmentId: Number(career.departmentId),
        positionId: career.positionId ? Number(career.positionId) : null,
        salaryMode: career.salaryMode,
        salary:
          career.salaryMode === "custom" ? Number(career.salary) : undefined,
        effectiveAt: career.effectiveAt,
        reason: career.reason.trim(),
        leadershipAssignment: {
          type:
            mode === "enterprise" ? "enterprise_director" : "department_head",
          targetId: mode === "enterprise" ? enterpriseId : departmentId!,
        },
      });
      toast.success(
        mode === "enterprise"
          ? "Кадровое изменение и назначение руководителя предприятия сохранены"
          : "Кадровое изменение и назначение руководителя отдела сохранены",
      );
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          mode === "enterprise"
            ? "Не удалось назначить руководителя предприятия"
            : "Не удалось назначить руководителя отдела",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      description={`Назначение ${leadershipLabel} оформляется отдельным кадровым изменением. Можно выбрать любого доступного активного сотрудника, даже если он уже работает в другом отделе или предприятии.`}
      onOpenChange={onOpenChange}
      open={open}
      title={
        mode === "enterprise"
          ? "Назначить руководителя предприятия"
          : "Назначить руководителя отдела"
      }
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
              <p className="app-text font-black">Текущее назначение сотрудника</p>
              <p className="app-muted mt-1 leading-6">
                {assignmentLabel(selectedCandidate)}
              </p>
            </div>
          )}

          {selectedAlreadyLeads && (
            <div className="app-accent-soft app-border rounded-2xl border p-4 text-sm font-semibold">
              Этот сотрудник уже назначен текущим руководителем. Чтобы заменить его,
              выберите другого сотрудника; чтобы снять назначение — выберите «Не назначен».
            </div>
          )}

          {selectedCandidate && !selectedAlreadyLeads && (
            <div className="grid gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
              <div>
                <p className="app-text text-sm font-black">
                  Кадровое изменение: назначение {leadershipLabel}
                </p>
                <p className="app-muted mt-1 text-xs leading-5">
                  После сохранения сотрудник будет относиться к предприятию «{enterpriseName}»
                  {mode === "department" ? ` и отделу «${departmentName}»` : ""}. Его текущее назначение при необходимости будет изменено в рамках того же кадрового события.
                </p>
              </div>

              {!canChangeEmployment && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Для назначения руководителя требуется разрешение «Кадровые изменения».
                </div>
              )}

              <Field label="Предприятие после изменения">
                <Input disabled value={enterpriseName} />
              </Field>

              {mode === "department" ? (
                <Field label="Отдел после изменения">
                  <Input disabled value={departmentName} />
                </Field>
              ) : (
                <Field label="Отдел сотрудника после изменения">
                  <SearchableSelect
                    disabled={!canChangeEmployment}
                    noOptionsLabel="В предприятии нет отделов"
                    onValueChange={changeDepartment}
                    options={departmentOptions}
                    placeholder="Выберите отдел"
                    searchPlaceholder="Поиск отдела"
                    value={career.departmentId}
                  />
                </Field>
              )}

              <Field label="Должность после изменения">
                <SearchableSelect
                  allowEmpty
                  disabled={!canChangeEmployment || !career.departmentId}
                  emptyOptionLabel="Без отдельной должности"
                  noOptionsLabel="В выбранном отделе нет должностей"
                  onValueChange={(positionId) =>
                    setCareer((value) => ({ ...value, positionId }))
                  }
                  options={availablePositions}
                  placeholder={
                    career.departmentId
                      ? "Без отдельной должности"
                      : "Сначала выберите отдел"
                  }
                  searchPlaceholder="Поиск должности"
                  value={career.positionId}
                />
              </Field>

              <Field label="Оклад">
                <Select
                  disabled={!canChangeEmployment}
                  onValueChange={(salaryMode) =>
                    setCareer((value) => ({
                      ...value,
                      salaryMode: salaryMode as CareerState["salaryMode"],
                    }))
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

              <Field label="Основание кадрового изменения">
                <Textarea
                  disabled={!canChangeEmployment}
                  onChange={(event) =>
                    setCareer((value) => ({ ...value, reason: event.target.value }))
                  }
                  placeholder={`Например: назначение ${leadershipLabel} по приказу №...`}
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
                Boolean(leaderId && !selectedAlreadyLeads && !canChangeEmployment)
              }
              onClick={() => void save()}
            >
              {selectedAlreadyLeads
                ? "Закрыть"
                : leaderId
                  ? "Сохранить кадровое изменение"
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

function initialCareer(): CareerState {
  return {
    departmentId: "",
    positionId: "",
    salaryMode: "keep",
    salary: "0",
    effectiveAt: new Date().toISOString().slice(0, 10),
    reason: "",
  };
}

function initialCareerForTarget(
  mode: LeadershipMode,
  departmentId: number | null,
  departments: HrRecord[],
): CareerState {
  const initial = initialCareer();
  if (mode === "department" && departmentId) {
    initial.departmentId = String(departmentId);
    return initial;
  }
  if (departments.length === 1) {
    initial.departmentId = String(departments[0].id ?? "");
  }
  return initial;
}

function careerFromCandidate(
  candidate: HrRecord,
  mode: LeadershipMode,
  departmentId: number | null,
  departments: HrRecord[],
  positions: HrRecord[],
): CareerState {
  const result = initialCareerForTarget(mode, departmentId, departments);
  const candidateDepartmentId = String(candidate.department_id ?? "");
  const targetDepartmentIds = new Set(
    departments.map((item) => String(item.id ?? "")),
  );

  if (
    mode === "enterprise" &&
    candidateDepartmentId &&
    targetDepartmentIds.has(candidateDepartmentId)
  ) {
    result.departmentId = candidateDepartmentId;
  }

  const candidatePositionId = String(candidate.position_id ?? "");
  result.positionId = positionBelongsToDepartment(
    candidatePositionId,
    result.departmentId,
    positions,
  )
    ? candidatePositionId
    : "";
  result.salary = String(candidate.salary ?? 0);
  return result;
}

function positionBelongsToDepartment(
  positionId: string,
  departmentId: string,
  positions: HrRecord[],
): boolean {
  if (!positionId || !departmentId) return false;
  return positions.some(
    (position) =>
      String(position.id ?? "") === positionId &&
      String(position.department_id ?? "") === departmentId,
  );
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

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
