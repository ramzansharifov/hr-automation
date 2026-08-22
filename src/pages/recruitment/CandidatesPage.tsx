import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiEdit2,
  FiRefreshCw,
  FiTrash2,
  FiUserPlus,
} from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import {
  FormField,
  MatchBar,
  RecruitmentBadge,
  RecruitmentPageHeader,
} from "../../features/recruitment/RecruitmentUi";
import {
  CANDIDATE_FILTERS_EVENT,
  filterCandidates,
  getStoredCandidateFilterValues,
  type CandidateFilterValues,
} from "../../features/filters/moduleFiltersStore";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  CandidateProfile,
  HireCandidateParams,
  HrRecord,
  SaveCandidateParams,
} from "../../shared/types/hr";
import {
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  IconButton,
  Input,
  Select,
  type DataTableColumn,
  type SelectOption,
} from "../../shared/ui";

interface CandidateFormState {
  id?: number;
  vacancyId: string;
  lastName: string;
  firstName: string;
  middleName: string;
  phone: string;
  email: string;
  status: SaveCandidateParams["status"];
  source: string;
  skills: CandidateSkillState[];
  statusHistory: HrRecord[];
  employeeId?: number;
}

interface CandidateSkillState {
  vacancySkillId: number;
  name: string;
  requiredLevel: number;
  score: number;
}

interface HireFormState {
  hireDate: string;
  salary: string;
  employeeNumber: string;
  contractNumber: string;
  contractDate: string;
  contractEndDate: string;
  probationEndDate: string;
  workplace: string;
}

const emptyForm = (): CandidateFormState => ({
  vacancyId: "",
  lastName: "",
  firstName: "",
  middleName: "",
  phone: "",
  email: "",
  status: "new",
  source: "",
  skills: [],
  statusHistory: [],
});

const emptyHireForm = (): HireFormState => ({
  hireDate: new Date().toISOString().slice(0, 10),
  salary: "0",
  employeeNumber: "",
  contractNumber: "",
  contractDate: new Date().toISOString().slice(0, 10),
  contractEndDate: "",
  probationEndDate: "",
  workplace: "",
});

export function CandidatesPage(): JSX.Element {
  const { hasPermission } = useAuth();
  const canViewVacancies = hasPermission("vacancies.view");
  const canCreate = hasPermission("candidates.create") && canViewVacancies;
  const canEdit = hasPermission("candidates.edit") && canViewVacancies;
  const canDelete = hasPermission("candidates.delete");
  const canHire = hasPermission("candidates.hire");
  const [searchParams, setSearchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<HrRecord[]>([]);
  const [vacancies, setVacancies] = useState<HrRecord[]>([]);
  const [filters, setFilters] = useState<CandidateFilterValues>(
    getStoredCandidateFilterValues,
  );
  const [form, setForm] = useState<CandidateFormState>(emptyForm);
  const [hireForm, setHireForm] = useState<HireFormState>(emptyHireForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);

  const filteredCandidates = useMemo(
    () => filterCandidates(candidates, filters),
    [candidates, filters],
  );

  const vacancyOptions = useMemo<SelectOption[]>(
    () =>
      vacancies.map((vacancy) => ({
        value: String(vacancy.id),
        label: [vacancy.enterprise_name, vacancy.department_name, vacancy.position_name]
          .filter(Boolean)
          .join(" · "),
      })),
    [vacancies],
  );

  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const candidateRows = await hrApiClient.listCandidates({});
      const vacancyRows = canViewVacancies
        ? await hrApiClient.listVacancies({})
        : [];
      setCandidates(candidateRows);
      setVacancies(vacancyRows);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить кандидатов"));
    } finally {
      setIsLoading(false);
    }
  }, [canViewVacancies]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    function refreshFilters(): void {
      setFilters(getStoredCandidateFilterValues());
    }
    window.addEventListener(CANDIDATE_FILTERS_EVENT, refreshFilters);
    window.addEventListener("storage", refreshFilters);
    return () => {
      window.removeEventListener(CANDIDATE_FILTERS_EVENT, refreshFilters);
      window.removeEventListener("storage", refreshFilters);
    };
  }, []);

  useEffect(() => {
    const candidateId = Number(searchParams.get("candidate"));
    if (isLoading || !Number.isInteger(candidateId) || candidateId <= 0) return;
    void openCandidate({ id: candidateId }).finally(() => {
      setSearchParams(new URLSearchParams(), { replace: true });
    });
  }, [isLoading, searchParams, setSearchParams]);

  function openCreate(): void {
    if (!canCreate) return;
    if (vacancies.length === 0) {
      toast.info("Сначала создайте или откройте вакансию с набором навыков");
      return;
    }
    setForm(emptyForm());
    setIsDialogOpen(true);
  }

  async function selectVacancy(vacancyId: string): Promise<void> {
    setForm((current) => ({ ...current, vacancyId, skills: [] }));
    if (!vacancyId) return;
    try {
      const profile = await hrApiClient.getVacancy(Number(vacancyId));
      if (!profile) throw new Error("Вакансия не найдена");
      setForm((current) => ({
        ...current,
        vacancyId,
        skills: profile.skills.map((skill) => ({
          vacancySkillId: Number(skill.id),
          name: String(skill.name ?? ""),
          requiredLevel: Number(skill.required_level ?? 5),
          score: 0,
        })),
      }));
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить навыки вакансии"));
    }
  }

  async function openCandidate(record: HrRecord): Promise<void> {
    try {
      const profile = await hrApiClient.getCandidate(Number(record.id));
      if (!profile) throw new Error("Кандидат не найден");
      setForm(profileToForm(profile));
      setIsDialogOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось открыть кандидата"));
    }
  }

  async function saveCandidate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (form.employeeId || (form.id ? !canEdit : !canCreate)) return;
    setIsSaving(true);
    try {
      await hrApiClient.saveCandidate({
        id: form.id,
        vacancyId: Number(form.vacancyId),
        lastName: form.lastName,
        firstName: form.firstName,
        middleName: form.middleName,
        phone: form.phone,
        email: form.email,
        status: form.status,
        source: form.source,
        skillScores: form.skills.map((skill) => ({
          vacancySkillId: skill.vacancySkillId,
          score: skill.score,
        })),
      });
      setIsDialogOpen(false);
      await loadData();
      toast.success(form.id ? "Кандидат обновлён" : "Кандидат добавлен");
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось сохранить кандидата"));
    } finally {
      setIsSaving(false);
    }
  }

  function openHire(): void {
    if (!canHire || !form.id || form.status !== "offer" || form.employeeId) return;
    setHireForm(emptyHireForm());
    setHireOpen(true);
  }

  async function hireCandidate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!form.id || !canHire) return;
    setIsSaving(true);
    try {
      const params: HireCandidateParams = {
        candidateId: form.id,
        hireDate: hireForm.hireDate,
        salary: Number(hireForm.salary),
        employeeNumber: hireForm.employeeNumber || undefined,
        contractNumber: hireForm.contractNumber || undefined,
        contractDate: hireForm.contractDate || undefined,
        contractEndDate: hireForm.contractEndDate || undefined,
        probationEndDate: hireForm.probationEndDate || undefined,
        workplace: hireForm.workplace || undefined,
      };
      const employee = await hrApiClient.hireCandidate(params);
      setHireOpen(false);
      setIsDialogOpen(false);
      await loadData();
      toast.success(`Сотрудник создан. ID: ${String(employee.id)}`);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось принять кандидата на работу"));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCandidate(): Promise<void> {
    if (!deleteTarget || !canDelete) return;
    setIsSaving(true);
    try {
      await hrApiClient.deleteCandidate(Number(deleteTarget.id));
      setDeleteTarget(null);
      await loadData();
      toast.success("Ошибочная запись кандидата удалена");
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось удалить кандидата"));
    } finally {
      setIsSaving(false);
    }
  }

  const previewMatch = calculateMatch(form.skills);
  const formDisabled = Boolean(form.employeeId) || (form.id ? !canEdit : !canCreate);

  return (
    <div className="space-y-6">
      <RecruitmentPageHeader
        actionLabel={canCreate ? "Добавить кандидата" : undefined}
        description="Кандидаты по вакансиям, этапы подбора и оценка соответствия навыкам."
        icon={<FiUserPlus className="h-6 w-6" />}
        onAction={canCreate ? openCreate : undefined}
        title="Кандидаты"
      />

      <CandidatesTable
        canCreate={canCreate}
        canDelete={canDelete}
        canEdit={canEdit}
        candidates={filteredCandidates}
        hasAnyCandidates={candidates.length > 0}
        isLoading={isLoading}
        onDelete={setDeleteTarget}
        onOpen={(candidate) => void openCandidate(candidate)}
        onRefresh={() => void loadData()}
      />

      <Dialog
        description={form.employeeId ? "Кандидат уже принят на работу. Запись сохранена как история подбора." : "Карточка кандидата, этап подбора и оценка навыков."}
        onOpenChange={setIsDialogOpen}
        open={isDialogOpen}
        title={form.id ? "Карточка кандидата" : "Новый кандидат"}
      >
        <form className="grid gap-5" onSubmit={saveCandidate}>
          <FormField label="Вакансия">
            <Select
              disabled={formDisabled}
              onValueChange={(value) => void selectVacancy(value)}
              options={vacancyOptions}
              placeholder="Выберите вакансию"
              value={form.vacancyId}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInputField disabled={formDisabled} label="Фамилия" required value={form.lastName} onChange={(lastName) => setForm((v) => ({ ...v, lastName }))} />
            <TextInputField disabled={formDisabled} label="Имя" required value={form.firstName} onChange={(firstName) => setForm((v) => ({ ...v, firstName }))} />
            <TextInputField disabled={formDisabled} label="Отчество" value={form.middleName} onChange={(middleName) => setForm((v) => ({ ...v, middleName }))} />
            <FormField label="Этап подбора">
              <Select
                disabled={formDisabled}
                onValueChange={(status) => setForm((v) => ({ ...v, status: status as CandidateFormState["status"] }))}
                options={form.employeeId ? hiredStatusOptions : candidateStatusOptions}
                value={form.status}
              />
            </FormField>
            <TextInputField disabled={formDisabled} label="Телефон" type="tel" value={form.phone} onChange={(phone) => setForm((v) => ({ ...v, phone }))} />
            <TextInputField disabled={formDisabled} label="Email" type="email" value={form.email} onChange={(email) => setForm((v) => ({ ...v, email }))} />
            <TextInputField disabled={formDisabled} label="Источник" value={form.source} onChange={(source) => setForm((v) => ({ ...v, source }))} placeholder="Рекомендация, сайт, соцсеть" />
          </div>

          <section className="app-surface-muted app-border rounded-[24px] border p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="app-text text-lg font-black">Оценка навыков</h3>
                <p className="app-muted mt-1 text-xs font-semibold">0 — навыка нет, 10 — экспертный уровень.</p>
              </div>
              <MatchBar value={previewMatch} />
            </div>
            <div className="mt-5 space-y-3">
              {form.skills.map((skill) => (
                <div className="app-surface app-border grid gap-4 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_110px] sm:items-center" key={skill.vacancySkillId}>
                  <div>
                    <p className="app-text font-black">{skill.name}</p>
                    <p className="app-muted mt-1 text-xs font-semibold">Требуется: {skill.requiredLevel}/10</p>
                  </div>
                  <Input
                    aria-label={`Оценка навыка ${skill.name}`}
                    disabled={formDisabled}
                    max="10"
                    min="0"
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      skills: current.skills.map((item) => item.vacancySkillId === skill.vacancySkillId ? { ...item, score: Number(event.target.value) } : item),
                    }))}
                    required
                    type="number"
                    value={skill.score}
                  />
                </div>
              ))}
            </div>
          </section>

          {form.id && form.statusHistory.length > 0 && (
            <section className="app-surface-muted app-border rounded-[24px] border p-5">
              <h3 className="app-text font-black">История этапов</h3>
              <div className="mt-3 space-y-2">
                {form.statusHistory.slice(0, 8).map((item) => (
                  <div className="app-surface app-border flex items-center justify-between gap-4 rounded-xl border px-4 py-3" key={String(item.id)}>
                    <span className="app-text text-sm font-bold">{candidateStatusLabel(String(item.new_status))}</span>
                    <span className="app-muted text-xs font-bold">{formatHistoryDate(item.changed_at)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={() => setIsDialogOpen(false)} type="button" variant="secondary">Закрыть</Button>
            {canHire && form.id && form.status === "offer" && !form.employeeId && (
              <Button leftIcon={<FiCheckCircle />} onClick={openHire} type="button">Принять на работу</Button>
            )}
            {!form.employeeId && ((form.id && canEdit) || (!form.id && canCreate)) && (
              <Button disabled={isSaving || form.skills.length === 0} type="submit">Сохранить кандидата</Button>
            )}
          </div>
        </form>
      </Dialog>

      {canHire && (
        <Dialog
          description="Сотрудник будет создан на предприятии, в отделе и на должности выбранной вакансии."
          onOpenChange={setHireOpen}
          open={hireOpen}
          title="Принять кандидата на работу"
        >
          <form className="grid gap-4" onSubmit={hireCandidate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <HireField label="Дата выхода" required type="date" value={hireForm.hireDate} onChange={(hireDate) => setHireForm((v) => ({ ...v, hireDate }))} />
              <HireField label="Согласованный оклад" required min="0" type="number" value={hireForm.salary} onChange={(salary) => setHireForm((v) => ({ ...v, salary }))} />
              <HireField label="Табельный номер" value={hireForm.employeeNumber} onChange={(employeeNumber) => setHireForm((v) => ({ ...v, employeeNumber }))} />
              <HireField label="Номер трудового договора" value={hireForm.contractNumber} onChange={(contractNumber) => setHireForm((v) => ({ ...v, contractNumber }))} />
              <HireField label="Дата договора" type="date" value={hireForm.contractDate} onChange={(contractDate) => setHireForm((v) => ({ ...v, contractDate }))} />
              <HireField label="Окончание договора" type="date" value={hireForm.contractEndDate} onChange={(contractEndDate) => setHireForm((v) => ({ ...v, contractEndDate }))} />
              <HireField label="Окончание испытательного срока" type="date" value={hireForm.probationEndDate} onChange={(probationEndDate) => setHireForm((v) => ({ ...v, probationEndDate }))} />
              <HireField label="Место работы" value={hireForm.workplace} onChange={(workplace) => setHireForm((v) => ({ ...v, workplace }))} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button onClick={() => setHireOpen(false)} type="button" variant="secondary">Отмена</Button>
              <Button disabled={isSaving} type="submit">Создать сотрудника</Button>
            </div>
          </form>
        </Dialog>
      )}

      {canDelete && (
        <ConfirmDialog
          cancelLabel="Отмена"
          confirmLabel="Удалить ошибочную запись"
          description="Удаление предназначено только для ошибочно созданных кандидатов. Принятого кандидата удалить нельзя."
          isLoading={isSaving}
          onConfirm={() => void deleteCandidate()}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          open={Boolean(deleteTarget)}
          title="Удалить кандидата?"
        />
      )}
    </div>
  );
}

function TextInputField({
  disabled,
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}): JSX.Element {
  return (
    <FormField label={label}>
      <Input disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} value={value} />
    </FormField>
  );
}

function HireField({
  label,
  min,
  onChange,
  required,
  type = "text",
  value,
}: {
  label: string;
  min?: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}): JSX.Element {
  return (
    <FormField label={label}>
      <Input min={min} onChange={(event) => onChange(event.target.value)} required={required} type={type} value={value} />
    </FormField>
  );
}

function CandidatesTable({
  canCreate,
  canDelete,
  canEdit,
  candidates,
  hasAnyCandidates,
  isLoading,
  onDelete,
  onOpen,
  onRefresh,
}: {
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  candidates: HrRecord[];
  hasAnyCandidates: boolean;
  isLoading: boolean;
  onDelete: (candidate: HrRecord) => void;
  onOpen: (candidate: HrRecord) => void;
  onRefresh: () => void;
}): JSX.Element {
  const hasActions = canEdit || canDelete;
  const columns: DataTableColumn<HrRecord>[] = [
    {
      key: "name",
      header: "ФИО",
      render: (candidate) => (
        <span className="app-text font-black">{candidateFullName(candidate)}</span>
      ),
    },
    {
      key: "vacancy",
      header: "Вакансия / структура",
      render: (candidate) => (
        <div className="min-w-[210px]">
          <p className="app-text font-bold">{String(candidate.position_name ?? "—")}</p>
          <p className="app-muted mt-1 text-xs font-semibold">
            {[candidate.enterprise_name, candidate.department_name].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "contacts",
      header: "Контакты",
      render: (candidate) => (
        <div className="min-w-[170px] space-y-1">
          <p className="app-text-soft text-sm">{String(candidate.phone ?? "—")}</p>
          <p className="app-muted truncate text-xs">{String(candidate.email ?? "—")}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Этап",
      render: (candidate) => (
        <RecruitmentBadge tone={candidate.status === "hired" ? "success" : candidate.status === "offer" ? "warning" : "accent"}>
          {candidateStatusLabel(String(candidate.status))}
        </RecruitmentBadge>
      ),
    },
    {
      key: "match",
      header: "Соответствие",
      render: (candidate) => (
        <div className="min-w-[160px]">
          <MatchBar value={Number(candidate.match_percentage ?? 0)} />
        </div>
      ),
    },
    {
      key: "source",
      header: "Источник",
      render: (candidate) => (
        <span className="app-text-soft">{String(candidate.source ?? "—")}</span>
      ),
    },
    ...(hasActions
      ? [
          {
            key: "actions",
            header: "Действия",
            align: "center" as const,
            render: (candidate: HrRecord) => (
              <div
                className="flex items-center justify-center gap-2"
                onClick={(event) => event.stopPropagation()}
              >
                {canEdit && (
                  <IconButton
                    icon={<FiEdit2 />}
                    label="Редактировать кандидата"
                    onClick={() => onOpen(candidate)}
                    size="sm"
                  />
                )}
                {canDelete && !candidate.employee_id && (
                  <IconButton
                    icon={<FiTrash2 />}
                    label="Удалить кандидата"
                    onClick={() => onDelete(candidate)}
                    size="sm"
                    tone="danger"
                  />
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      ariaLabel="Реестр кандидатов"
      columns={columns}
      emptyDescription={
        hasAnyCandidates
          ? "Измените или очистите фильтры на странице фильтров."
          : canCreate
            ? "Добавьте кандидата к существующей вакансии и оцените его навыки."
            : "В доступной области пока нет кандидатов."
      }
      emptyTitle={hasAnyCandidates ? "Нет кандидатов по выбранным фильтрам" : "Кандидатов пока нет"}
      footer={<>Кандидатов: <span className="app-text font-black">{candidates.length}</span></>}
      getRowKey={(candidate) => String(candidate.id)}
      isLoading={isLoading}
      loadingLabel="Загрузка кандидатов..."
      onRowClick={onOpen}
      rows={candidates}
      toolbar={
        <div className="ml-auto">
          <Button
            leftIcon={<FiRefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
            onClick={onRefresh}
            type="button"
            variant="secondary"
          >
            Обновить
          </Button>
        </div>
      }
    />
  );
}

function candidateFullName(candidate: HrRecord): string {
  return [candidate.last_name, candidate.first_name, candidate.middle_name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ") || "Без имени";
}

function profileToForm(profile: CandidateProfile): CandidateFormState {
  const scores = new Map(profile.skillScores.map((score) => [Number(score.vacancy_skill_id), score]));
  const candidate = profile.candidate;
  return {
    id: Number(candidate.id),
    vacancyId: String(candidate.vacancy_id),
    lastName: String(candidate.last_name ?? ""),
    firstName: String(candidate.first_name ?? ""),
    middleName: String(candidate.middle_name ?? ""),
    phone: String(candidate.phone ?? ""),
    email: String(candidate.email ?? ""),
    status: String(candidate.status) as CandidateFormState["status"],
    source: String(candidate.source ?? ""),
    employeeId: candidate.employee_id ? Number(candidate.employee_id) : undefined,
    statusHistory: profile.statusHistory,
    skills: profile.vacancySkills.map((skill) => {
      const score = scores.get(Number(skill.id));
      return {
        vacancySkillId: Number(skill.id),
        name: String(skill.name),
        requiredLevel: Number(skill.required_level),
        score: Number(score?.score ?? 0),
      };
    }),
  };
}

function calculateMatch(skills: CandidateSkillState[]): number {
  if (skills.length === 0) return 0;
  const points = skills.reduce(
    (sum, skill) => sum + Math.min(skill.score / Math.max(skill.requiredLevel, 1), 1),
    0,
  );
  return Math.round((points / skills.length) * 100);
}

const candidateStatusOptions: SelectOption[] = [
  { value: "new", label: "Новый" },
  { value: "screening", label: "Первичный отбор" },
  { value: "interview", label: "Собеседование" },
  { value: "offer", label: "Оффер" },
  { value: "rejected", label: "Отклонён" },
];
const hiredStatusOptions: SelectOption[] = [{ value: "hired", label: "Принят" }];

function candidateStatusLabel(value: string): string {
  return [...candidateStatusOptions, ...hiredStatusOptions].find((item) => item.value === value)?.label ?? value;
}

function formatHistoryDate(value: unknown): string {
  if (!value) return "—";
  const date = new Date(`${String(value).replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("ru-RU");
}

function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
