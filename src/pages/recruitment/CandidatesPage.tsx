import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiEdit2,
  FiMail,
  FiPhone,
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
  IconButton,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Input,
  LoadingState,
  Select,
  ViewModeToggle,
  useStoredViewMode,
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
  weight: number;
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
  const canManage = hasPermission("recruitment.manage");
  const [searchParams, setSearchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<HrRecord[]>([]);
  const [vacancies, setVacancies] = useState<HrRecord[]>([]);
  const [filters, setFilters] = useState<CandidateFilterValues>(
    getStoredCandidateFilterValues,
  );
  const [viewMode, setViewMode] = useStoredViewMode("candidates", "cards");
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
      const [candidateRows, vacancyRows] = await Promise.all([
        hrApiClient.listCandidates({}),
        hrApiClient.listVacancies({}),
      ]);
      setCandidates(candidateRows);
      setVacancies(vacancyRows);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить кандидатов"));
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    if (!canManage) return;
    if (vacancies.length === 0) {
      toast.info("Сначала создайте вакансию с набором навыков");
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
          weight: Number(skill.weight ?? 3),
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
    if (!canManage || form.employeeId) return;
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
    if (!canManage || !form.id || form.status !== "offer" || form.employeeId) return;
    setHireForm(emptyHireForm());
    setHireOpen(true);
  }

  async function hireCandidate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!form.id) return;
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
    if (!deleteTarget || !canManage) return;
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
  const formDisabled = !canManage || Boolean(form.employeeId);

  return (
    <div className="space-y-6">
      <RecruitmentPageHeader
        actionLabel={canManage ? "Добавить кандидата" : undefined}
        description="Кандидаты по вакансиям, этапы подбора и оценка соответствия навыкам."
        icon={<FiUserPlus className="h-6 w-6" />}
        onAction={canManage ? openCreate : undefined}
        title="Кандидаты"
      />

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <ViewModeToggle onChange={setViewMode} value={viewMode} />
          <IconButton icon={<FiEdit2 />} label={`Оценка навыка ${skill.name} onClick={() => void loadData()} size="sm" />
                  {canManage && !candidate.employee_id && (
                    <IconButton icon={<FiTrash2 />} label="Удалить кандидата" onClick={() => onDelete(candidate)} size="sm" tone="danger" />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidateCard({
  canManage,
  candidate,
  onDelete,
  onOpen,
}: {
  canManage: boolean;
  candidate: HrRecord;
  onDelete: () => void;
  onOpen: () => void;
}): JSX.Element {
  const skills = String(candidate.skills_summary ?? "").split("\u001f").filter(Boolean);
  return (
    <article className="app-surface app-border grid gap-5 rounded-[26px] border p-5 transition-colors hover:border-[var(--accent-border)] lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <RecruitmentBadge tone={candidate.status === "hired" ? "success" : "accent"}>{candidateStatusLabel(String(candidate.status))}</RecruitmentBadge>
          {candidate.source && <RecruitmentBadge>{String(candidate.source)}</RecruitmentBadge>}
        </div>
        <h2 className="app-text mt-3 text-xl font-black">{candidateFullName(candidate)}</h2>
        <p className="app-muted mt-1 text-sm font-bold">{[candidate.enterprise_name, candidate.department_name, candidate.position_name].filter(Boolean).join(" · ")}</p>
        <div className="app-muted mt-3 flex flex-wrap gap-4 text-sm">
          {candidate.phone && <span className="flex items-center gap-2"><FiPhone className="h-4 w-4" /> {String(candidate.phone)}</span>}
          {candidate.email && <span className="flex items-center gap-2"><FiMail className="h-4 w-4" /> {String(candidate.email)}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {skills.slice(0, 5).map((skill) => <RecruitmentBadge key={skill}>{skill}</RecruitmentBadge>)}
        </div>
      </div>
      <MatchBar value={Number(candidate.match_percentage ?? 0)} />
      <div className="flex gap-2 lg:justify-end">
        <Button className="h-10 w-10 p-0" onClick={onOpen} variant="ghost"><FiEdit2 className="h-4 w-4" /></Button>
        {canManage && !candidate.employee_id && (
          <Button className="h-10 w-10 p-0" onClick={onDelete} variant="ghost"><FiTrash2 className="h-4 w-4" /></Button>
        )}
      </div>
    </article>
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
        weight: Number(skill.weight),
        score: Number(score?.score ?? 0),
      };
    }),
  };
}

function calculateMatch(skills: CandidateSkillState[]): number {
  const totalWeight = skills.reduce((sum, skill) => sum + skill.weight, 0);
  if (totalWeight === 0) return 0;
  const points = skills.reduce(
    (sum, skill) => sum + Math.min(skill.score / Math.max(skill.requiredLevel, 1), 1) * skill.weight,
    0,
  );
  return Math.round((points / totalWeight) * 100);
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
