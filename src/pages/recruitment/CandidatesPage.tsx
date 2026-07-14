import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiEdit2,
  FiMail,
  FiPhone,
  FiTrash2,
  FiUserPlus,
} from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

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
  HrRecord,
  SaveCandidateParams,
} from "../../shared/types/hr";
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Input,
  LoadingState,
  Select,
  Textarea,
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
  note: string;
  skills: CandidateSkillState[];
}

interface CandidateSkillState {
  vacancySkillId: number;
  name: string;
  requiredLevel: number;
  weight: number;
  score: number;
  note: string;
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
  note: "",
  skills: [],
});

export function CandidatesPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<HrRecord[]>([]);
  const [vacancies, setVacancies] = useState<HrRecord[]>([]);
  const [filters, setFilters] = useState<CandidateFilterValues>(
    getStoredCandidateFilterValues,
  );
  const [form, setForm] = useState<CandidateFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);

  const filteredCandidates = useMemo(
    () => filterCandidates(candidates, filters),
    [candidates, filters],
  );

  const vacancyOptions = useMemo<SelectOption[]>(
    () =>
      vacancies.map((vacancy) => ({
        value: String(vacancy.id),
        label: [vacancy.position_name, vacancy.department_name, vacancy.enterprise_name]
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

    void openEdit({ id: candidateId }).finally(() => {
      setSearchParams(new URLSearchParams(), { replace: true });
    });
  }, [isLoading, searchParams, setSearchParams]);

  function openCreate(): void {
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
          note: "",
        })),
      }));
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить навыки вакансии"));
    }
  }

  async function openEdit(record: HrRecord): Promise<void> {
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
        note: form.note,
        skillScores: form.skills.map((skill) => ({
          vacancySkillId: skill.vacancySkillId,
          score: skill.score,
          note: skill.note,
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

  async function deleteCandidate(): Promise<void> {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await hrApiClient.deleteCandidate(Number(deleteTarget.id));
      setDeleteTarget(null);
      await loadData();
      toast.success("Кандидат удалён");
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось удалить кандидата"));
    } finally {
      setIsSaving(false);
    }
  }

  const previewMatch = calculateMatch(form.skills);

  return (
    <div className="space-y-6">
      <RecruitmentPageHeader
        actionLabel="Добавить кандидата"
        description="Кандидаты по вакансиям, контактная информация и объективная оценка соответствия навыкам."
        icon={<FiUserPlus className="h-6 w-6" />}
        onAction={openCreate}
        title="Кандидаты"
      />

      {isLoading ? (
        <LoadingState label="Загрузка кандидатов..." />
      ) : filteredCandidates.length === 0 ? (
        <div className="app-surface app-border rounded-[28px] border py-12">
          <EmptyState
            title={
              candidates.length === 0
                ? "Кандидатов пока нет"
                : "Нет кандидатов по выбранным фильтрам"
            }
            description={
              candidates.length === 0
                ? "Добавьте кандидата к существующей вакансии и оцените его навыки."
                : "Измените или очистите фильтры в модуле «Фильтры»."
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCandidates.map((candidate) => (
            <CandidateCard
              candidate={candidate}
              key={String(candidate.id)}
              onDelete={() => setDeleteTarget(candidate)}
              onEdit={() => void openEdit(candidate)}
            />
          ))}
        </div>
      )}

      <Dialog
        description="Выберите вакансию и оцените кандидата по каждому требуемому навыку от 0 до 10."
        onOpenChange={setIsDialogOpen}
        open={isDialogOpen}
        title={form.id ? "Редактировать кандидата" : "Новый кандидат"}
      >
        <form className="grid gap-5" onSubmit={saveCandidate}>
          <FormField label="Вакансия">
            <Select
              onValueChange={(value) => void selectVacancy(value)}
              options={vacancyOptions}
              placeholder="Выберите вакансию"
              value={form.vacancyId}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Фамилия">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
                required
                value={form.lastName}
              />
            </FormField>
            <FormField label="Имя">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
                required
                value={form.firstName}
              />
            </FormField>
            <FormField label="Отчество">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    middleName: event.target.value,
                  }))
                }
                value={form.middleName}
              />
            </FormField>
            <FormField label="Статус">
              <Select
                onValueChange={(status) =>
                  setForm((current) => ({
                    ...current,
                    status: status as CandidateFormState["status"],
                  }))
                }
                options={candidateStatusOptions}
                value={form.status}
              />
            </FormField>
            <FormField label="Телефон">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                type="tel"
                value={form.phone}
              />
            </FormField>
            <FormField label="Email">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                type="email"
                value={form.email}
              />
            </FormField>
            <FormField label="Источник">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    source: event.target.value,
                  }))
                }
                placeholder="Рекомендация, сайт, соцсеть"
                value={form.source}
              />
            </FormField>
          </div>
          <FormField label="Заметка">
            <Textarea
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              rows={3}
              value={form.note}
            />
          </FormField>

          <section className="app-surface-muted app-border rounded-[24px] border p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="app-text text-lg font-black">Оценка навыков</h3>
                <p className="app-muted mt-1 text-xs font-semibold">
                  0 — навыка нет, 10 — экспертный уровень.
                </p>
              </div>
              <MatchBar value={previewMatch} />
            </div>
            <div className="mt-5 space-y-3">
              {form.skills.map((skill) => (
                <div
                  className="app-surface app-border grid gap-4 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_110px] sm:items-center"
                  key={skill.vacancySkillId}
                >
                  <div>
                    <p className="app-text font-black">{skill.name}</p>
                    <p className="app-muted mt-1 text-xs font-semibold">
                      Требуется: {skill.requiredLevel}/10 · Важность: {skill.weight}/5
                    </p>
                  </div>
                  <Input
                    aria-label={`Оценка навыка ${skill.name}`}
                    max="10"
                    min="0"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        skills: current.skills.map((item) =>
                          item.vacancySkillId === skill.vacancySkillId
                            ? { ...item, score: Number(event.target.value) }
                            : item,
                        ),
                      }))
                    }
                    required
                    type="number"
                    value={skill.score}
                  />
                </div>
              ))}
              {form.vacancyId && form.skills.length === 0 && (
                <p className="app-muted rounded-2xl border border-dashed p-4 text-sm">
                  У выбранной вакансии нет навыков. Добавьте их в разделе вакансий.
                </p>
              )}
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setIsDialogOpen(false)}
              type="button"
              variant="secondary"
            >
              Отмена
            </Button>
            <Button disabled={isSaving || form.skills.length === 0} type="submit">
              Сохранить кандидата
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        cancelLabel="Отмена"
        confirmLabel="Удалить"
        description="Кандидат и все его оценки навыков будут удалены."
        isLoading={isSaving}
        onConfirm={() => void deleteCandidate()}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={Boolean(deleteTarget)}
        title="Удалить кандидата?"
      />
    </div>
  );
}

function CandidateCard({
  candidate,
  onDelete,
  onEdit,
}: {
  candidate: HrRecord;
  onDelete: () => void;
  onEdit: () => void;
}): JSX.Element {
  const fullName = [
    candidate.last_name,
    candidate.first_name,
    candidate.middle_name,
  ]
    .filter(Boolean)
    .join(" ");
  const skills = String(candidate.skills_summary ?? "")
    .split("\u001f")
    .filter(Boolean);
  return (
    <article className="app-surface app-border grid gap-5 rounded-[26px] border p-5 transition-colors hover:border-[var(--accent-border)] lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <RecruitmentBadge tone="accent">
            {candidateStatusLabel(String(candidate.status))}
          </RecruitmentBadge>
          {Boolean(candidate.source) && (
            <RecruitmentBadge>{String(candidate.source)}</RecruitmentBadge>
          )}
        </div>
        <h2 className="app-text mt-3 text-xl font-black">{fullName}</h2>
        <p className="app-muted mt-1 text-sm font-bold">
          {String(candidate.vacancy_title)} · {String(candidate.position_name)}
        </p>
        <div className="app-muted mt-3 flex flex-wrap gap-4 text-sm">
          {Boolean(candidate.phone) && (
            <span className="flex items-center gap-2">
              <FiPhone className="h-4 w-4" /> {String(candidate.phone)}
            </span>
          )}
          {Boolean(candidate.email) && (
            <span className="flex items-center gap-2">
              <FiMail className="h-4 w-4" /> {String(candidate.email)}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {skills.slice(0, 5).map((skill) => (
            <RecruitmentBadge key={skill}>{skill}</RecruitmentBadge>
          ))}
          {skills.length > 5 && (
            <RecruitmentBadge>+{skills.length - 5}</RecruitmentBadge>
          )}
        </div>
      </div>
      <MatchBar value={Number(candidate.match_percentage ?? 0)} />
      <div className="flex gap-2 lg:justify-end">
        <Button className="h-10 w-10 p-0" onClick={onEdit} variant="ghost">
          <FiEdit2 className="h-4 w-4" />
        </Button>
        <Button className="h-10 w-10 p-0" onClick={onDelete} variant="ghost">
          <FiTrash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
}

function profileToForm(profile: CandidateProfile): CandidateFormState {
  const scores = new Map(
    profile.skillScores.map((score) => [
      Number(score.vacancy_skill_id),
      score,
    ]),
  );
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
    note: String(candidate.note ?? ""),
    skills: profile.vacancySkills.map((skill) => {
      const score = scores.get(Number(skill.id));
      return {
        vacancySkillId: Number(skill.id),
        name: String(skill.name),
        requiredLevel: Number(skill.required_level),
        weight: Number(skill.weight),
        score: Number(score?.score ?? 0),
        note: String(score?.note ?? ""),
      };
    }),
  };
}

function calculateMatch(skills: CandidateSkillState[]): number {
  const totalWeight = skills.reduce((sum, skill) => sum + skill.weight, 0);
  if (totalWeight === 0) return 0;
  const points = skills.reduce(
    (sum, skill) =>
      sum +
      Math.min(skill.score / Math.max(skill.requiredLevel, 1), 1) * skill.weight,
    0,
  );
  return Math.round((points / totalWeight) * 100);
}

const candidateStatusOptions: SelectOption[] = [
  { value: "new", label: "Новый" },
  { value: "screening", label: "Первичный отбор" },
  { value: "interview", label: "Собеседование" },
  { value: "offer", label: "Оффер" },
  { value: "hired", label: "Принят" },
  { value: "rejected", label: "Отклонён" },
];
function candidateStatusLabel(value: string): string {
  return candidateStatusOptions.find((item) => item.value === value)?.label ?? value;
}
function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
