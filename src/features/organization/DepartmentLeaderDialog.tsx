import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord } from "../../shared/types/hr";
import {
  Button,
  Dialog,
  LoadingState,
  SearchableSelect,
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
      return;
    }

    let active = true;
    setLoading(true);
    setConfirming(false);
    void loadActiveEmployees()
      .then((records) => {
        if (!active) return;
        setCandidates(records);
        setLeaderId(currentLeaderId ? String(currentLeaderId) : "");
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
  const leadershipName =
    mode === "enterprise" ? enterpriseName : departmentName;
  const canAssignEnterpriseLeader =
    mode !== "enterprise" || targetDepartments.length > 0;

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

    setLoading(true);
    try {
      const reason =
        mode === "enterprise"
          ? `Назначение директором предприятия «${enterpriseName}»`
          : `Назначение руководителем отдела «${departmentName}»`;

      await hrApiClient.changeEmployment({
        employeeId: Number(selectedCandidate.id),
        enterpriseId,
        departmentId: targetDepartmentId,
        positionId: null,
        salaryMode: "keep",
        effectiveAt: new Date().toISOString().slice(0, 10),
        reason,
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
          ? "Подтвердите кадровое изменение."
          : `Выберите активного сотрудника. Назначение ${leadershipTitle} автоматически заменит его текущее кадровое назначение.`
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
                  перестанет занимать текущую должность и будет назначен {leadershipTitle}{" "}
                  «{leadershipName}».
                </p>
                <p className="app-muted mt-2 text-sm leading-6">
                  Предыдущее назначение: {assignmentLabel(selectedCandidate)}. Оклад останется без изменений, а кадровое событие будет записано в журнал текущей датой.
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
                  Да, назначить
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
          <label className="grid gap-2">
            <span className="app-text text-sm font-black">Сотрудник</span>
            <SearchableSelect
              allowEmpty
              ariaLabel="Сотрудник"
              emptyOptionLabel="Не назначен"
              noOptionsLabel="Активные сотрудники не найдены"
              onValueChange={setLeaderId}
              options={options}
              placeholder="Выберите сотрудника"
              searchPlaceholder="Поиск по ФИО, предприятию, отделу или должности"
              value={leaderId}
            />
          </label>

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

          {leaderId && !selectedAlreadyLeads && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm font-semibold leading-6 text-amber-700 dark:text-amber-300">
              После подтверждения прежняя должность сотрудника будет прекращена автоматически. Он будет числиться именно как {leadershipTitle}. Оклад при этом не меняется.
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

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
