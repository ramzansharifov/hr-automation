import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAward,
  FiBriefcase,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import { CandidateSummaryCard } from "../../features/recruitment/CandidateSummaryCard";
import {
  FormField,
  RecruitmentBadge,
} from "../../features/recruitment/RecruitmentUi";
import { appText, useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord, VacancyProfile } from "../../shared/types/hr";
import {
  ActionButton,
  Dialog,
  FormActions,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
} from "../../shared/ui";

interface CandidateSkillDraft {
  vacancySkillId: number;
  name: string;
  requiredLevel: number;
  score: number;
}

interface CandidateDraft {
  lastName: string;
  firstName: string;
  middleName: string;
  phone: string;
  email: string;
  source: string;
  skills: CandidateSkillDraft[];
}

export function VacancyDetailsPage(): JSX.Element {
  const text = useAppText();
  const navigate = useNavigate();
  const { id } = useParams();
  const vacancyId = Number(id);
  const { hasPermission } = useAuth();
  const canEditVacancy = hasPermission("vacancies.edit");
  const canViewCandidates = hasPermission("candidates.view");
  const canCreateCandidate = hasPermission("candidates.create");

  const [profile, setProfile] = useState<VacancyProfile | null>(null);
  const [candidates, setCandidates] = useState<HrRecord[]>([]);
  const [candidateDraft, setCandidateDraft] = useState<CandidateDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async (): Promise<void> => {
    if (!Number.isInteger(vacancyId) || vacancyId <= 0) {
      navigate("/vacancies", { replace: true });
      return;
    }

    setIsLoading(true);
    try {
      const vacancyProfile = await hrApiClient.getVacancy(vacancyId);
      if (!vacancyProfile) throw new Error(text("Вакансия не найдена", "Vacancy not found"));
      setProfile(vacancyProfile);

      if (canViewCandidates) {
        const candidateRows = await hrApiClient.listCandidates({});
        setCandidates(
          candidateRows.filter(
            (candidate) => Number(candidate.vacancy_id) === vacancyId,
          ),
        );
      } else {
        setCandidates([]);
      }
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось загрузить вакансию", "Failed to load vacancy")));
      navigate("/vacancies", { replace: true });
    } finally {
      setIsLoading(false);
    }
  }, [canViewCandidates, navigate, text, vacancyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rankedCandidates = useMemo(
    () =>
      [...candidates].sort(
        (left, right) =>
          Number(right.match_percentage ?? 0) - Number(left.match_percentage ?? 0) ||
          Number(right.id ?? 0) - Number(left.id ?? 0),
      ),
    [candidates],
  );

  const hardSkills = useMemo(
    () => profile?.skills.filter((skill) => skill.skill_type === "hard") ?? [],
    [profile],
  );
  const softSkills = useMemo(
    () => profile?.skills.filter((skill) => skill.skill_type === "soft") ?? [],
    [profile],
  );

  const bestMatch = rankedCandidates.length
    ? Number(rankedCandidates[0].match_percentage ?? 0)
    : 0;
  const offerCount = candidates.filter((item) => item.status === "offer").length;
  const hiredCount = candidates.filter((item) => item.status === "hired").length;

  function openCandidateCreate(): void {
    if (!canCreateCandidate || !profile) return;
    if (
      profile.vacancy.status !== "open" ||
      Number(profile.vacancy.is_archived ?? 0) === 1
    ) {
      toast.info(text("Добавлять кандидатов можно только в открытую вакансию", "Candidates can only be added to an open vacancy"));
      return;
    }
    setCandidateDraft({
      lastName: "",
      firstName: "",
      middleName: "",
      phone: "",
      email: "",
      source: "",
      skills: profile.skills.map((skill) => ({
        vacancySkillId: Number(skill.id),
        name: String(skill.name ?? ""),
        requiredLevel: Number(skill.required_level ?? 5),
        score: 0,
      })),
    });
  }

  async function saveCandidate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!candidateDraft || !canCreateCandidate) return;
    setIsSaving(true);
    try {
      const saved = await hrApiClient.saveCandidate({
        vacancyId,
        lastName: candidateDraft.lastName,
        firstName: candidateDraft.firstName,
        middleName: candidateDraft.middleName || undefined,
        phone: candidateDraft.phone || undefined,
        email: candidateDraft.email || undefined,
        source: candidateDraft.source || undefined,
        skillScores: candidateDraft.skills.map((skill) => ({
          vacancySkillId: skill.vacancySkillId,
          score: skill.score,
        })),
      });
      setCandidateDraft(null);
      toast.success(text("Кандидат добавлен к вакансии на этапе «Новый»", "Candidate added to the vacancy at the New stage"));
      navigate("/candidates/" + String(saved.candidate.id));
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось добавить кандидата", "Failed to add candidate")));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !profile) {
    return <LoadingState label={text("Загрузка вакансии...", "Loading vacancy...")} />;
  }

  const vacancy = profile.vacancy;
  const title = String(vacancy.position_name ?? text("Вакансия", "Vacancy"));

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <ActionButton
              action="back"
              onClick={() => navigate("/vacancies")}
              type="button"
            >
              {text("К списку", "Back to list")}
            </ActionButton>
            {canEditVacancy && (
              <ActionButton
                action="edit"
                onClick={() => navigate(`/vacancies/${vacancyId}/edit`)}
                type="button"
              >
                {text("Редактировать", "Edit")}
              </ActionButton>
            )}
          </>
        }
        description={
          [vacancy.enterprise_name, vacancy.department_name]
            .filter(Boolean)
            .join(" · ") || text("Организационная структура не указана", "Organizational structure not specified")
        }
        eyebrow={text("Вакансия", "Vacancy")}
        icon={<FiBriefcase />}
        meta={
          <div className="flex flex-wrap gap-2">
            <RecruitmentBadge tone={vacancy.status === "open" ? "success" : "neutral"}>
              {vacancyStatusLabel(String(vacancy.status))}
            </RecruitmentBadge>
            <RecruitmentBadge>
              {employmentTypeLabel(String(vacancy.employment_type))}
            </RecruitmentBadge>
            <RecruitmentBadge tone="accent">
              {String(vacancy.openings_count ?? 1)} {text("мест", "openings")}
            </RecruitmentBadge>
          </div>
        }
        title={title}
      />

      {canViewCandidates && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<FiUsers />} label={text("Кандидатов", "Candidates")} value={String(candidates.length)} />
          <MetricCard icon={<FiAward />} label={text("Лучшее соответствие", "Best match")} value={`${Math.round(bestMatch)}%`} />
          <MetricCard icon={<FiBriefcase />} label={text("На этапе оффера", "At offer stage")} value={String(offerCount)} />
          <MetricCard icon={<FiUserPlus />} label={text("Принято", "Hired")} value={String(hiredCount)} />
        </div>
      )}

      <section className="app-surface app-border rounded-[28px] border p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.14em]">{text("Профиль вакансии", "Vacancy profile")}</p>
            <h2 className="app-text mt-1 text-xl font-black">{text("Требования по навыкам", "Skill requirements")}</h2>
          </div>
          <p className="app-muted text-sm">{text("Уровень показывает ожидаемое владение навыком по шкале 1–10.", "The level shows expected proficiency on a 1–10 scale.")}</p>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <SkillGroup title="Hard skills" skills={hardSkills} />
          <SkillGroup title="Soft skills" skills={softSkills} />
        </div>
      </section>

      {canViewCandidates && (
        <section className="app-surface app-border overflow-hidden rounded-[28px] border">
          <div className="app-border-soft flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="app-accent-text text-xs font-black uppercase tracking-[0.14em]">{text("Подбор", "Recruitment")}</p>
              <h2 className="app-text mt-1 text-2xl font-black">{text("Кандидаты на вакансию", "Candidates for this vacancy")}</h2>
              <p className="app-muted mt-1 text-sm">
                {text("Список автоматически отсортирован от наиболее подходящего кандидата к наименее подходящему.", "The list is automatically sorted from the best-matching candidate to the lowest match.")}
              </p>
            </div>
            {canCreateCandidate &&
              vacancy.status === "open" &&
              Number(vacancy.is_archived ?? 0) !== 1 && (
              <ActionButton action="create" onClick={openCandidateCreate} type="button">
                {text("Добавить кандидата", "Add candidate")}
              </ActionButton>
            )}
          </div>

          {rankedCandidates.length === 0 ? (
            <div className="py-16">
              <EmptyState
                title={text("Кандидатов пока нет", "No candidates yet")}
                description={
                  canCreateCandidate
                    ? text("Добавьте первого кандидата и оцените его навыки относительно требований этой вакансии.", "Add the first candidate and score their skills against the vacancy requirements.")
                    : "К этой вакансии пока не добавлены кандидаты."
                }
              />
            </div>
          ) : (
            <div className="grid gap-4 p-5 xl:grid-cols-2">
              {rankedCandidates.map((candidate, index) => (
                <CandidateSummaryCard
                  candidate={candidate}
                  isBest={index === 0 && Number(candidate.match_percentage ?? 0) > 0}
                  key={String(candidate.id)}
                  onOpen={() => navigate("/candidates/" + String(candidate.id))}
                  rank={index + 1}
                  showStructure={false}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {candidateDraft && canCreateCandidate && (
        <Dialog
          description={text(`Кандидат будет сразу привязан к вакансии «${title}». Оцените навыки по шкале 0–10.`, `The candidate will be linked directly to vacancy “${title}”. Score skills on a 0–10 scale.`)}
          footer={
            <FormActions
              loading={isSaving}
              onCancel={() => setCandidateDraft(null)}
              onSubmit={() => {
                const form = document.getElementById(
                  "vacancy-candidate-form",
                ) as HTMLFormElement | null;
                form?.requestSubmit();
              }}
              submitAction="create"
              submitDisabled={
                !candidateDraft.lastName.trim() ||
                !candidateDraft.firstName.trim()
              }
              submitLabel={text("Добавить кандидата", "Add candidate")}
              submitType="button"
            />
          }
          onOpenChange={(open) => !open && setCandidateDraft(null)}
          open
          size="lg"
          title={text("Новый кандидат", "New candidate")}
        >
          <form className="grid gap-5" id="vacancy-candidate-form" onSubmit={saveCandidate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={text("Фамилия", "Last name")}>
                <Input
                  autoFocus
                  onChange={(event) => setCandidateDraft((current) => current ? { ...current, lastName: event.target.value } : current)}
                  required
                  value={candidateDraft.lastName}
                />
              </FormField>
              <FormField label={text("Имя", "First name")}>
                <Input
                  onChange={(event) => setCandidateDraft((current) => current ? { ...current, firstName: event.target.value } : current)}
                  required
                  value={candidateDraft.firstName}
                />
              </FormField>
              <FormField label={text("Отчество", "Middle name")}>
                <Input
                  onChange={(event) => setCandidateDraft((current) => current ? { ...current, middleName: event.target.value } : current)}
                  value={candidateDraft.middleName}
                />
              </FormField>
              <FormField label={text("Источник", "Source")}>
                <Input
                  onChange={(event) => setCandidateDraft((current) => current ? { ...current, source: event.target.value } : current)}
                  placeholder={text("Сайт, рекомендация, соцсеть", "Website, referral, social network")}
                  value={candidateDraft.source}
                />
              </FormField>
              <FormField label={text("Телефон", "Phone")}>
                <Input
                  onChange={(event) => setCandidateDraft((current) => current ? { ...current, phone: event.target.value } : current)}
                  type="tel"
                  value={candidateDraft.phone}
                />
              </FormField>
              <FormField label="Email">
                <Input
                  onChange={(event) => setCandidateDraft((current) => current ? { ...current, email: event.target.value } : current)}
                  type="email"
                  value={candidateDraft.email}
                />
              </FormField>
            </div>

            <section className="app-surface-muted app-border rounded-2xl border p-4">
              <h3 className="app-text font-black">Оценка навыков</h3>
              <p className="app-muted mt-1 text-xs font-semibold">
                0 — навыка нет, 10 — экспертный уровень. Рядом указан требуемый уровень вакансии.
              </p>
              <div className="mt-4 space-y-3">
                {candidateDraft.skills.map((skill) => (
                  <div
                    className="app-surface app-border grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_110px] sm:items-center"
                    key={skill.vacancySkillId}
                  >
                    <div>
                      <p className="app-text font-bold">{skill.name}</p>
                      <p className="app-muted mt-1 text-xs">Требуется: {skill.requiredLevel}/10</p>
                    </div>
                    <Input
                      aria-label={text(`Оценка навыка ${skill.name}`, `Skill score ${skill.name}`)}
                      max="10"
                      min="0"
                      onChange={(event) => {
                        const score = Number(event.target.value);
                        setCandidateDraft((current) => current ? {
                          ...current,
                          skills: current.skills.map((item) =>
                            item.vacancySkillId === skill.vacancySkillId ? { ...item, score } : item,
                          ),
                        } : current);
                      }}
                      required
                      type="number"
                      value={skill.score}
                    />
                  </div>
                ))}
              </div>
            </section>
          </form>
        </Dialog>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: JSX.Element; label: string; value: string }): JSX.Element {
  return (
    <div className="app-surface app-border flex items-center gap-4 rounded-[22px] border p-4">
      <span className="app-accent-soft app-accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div>
        <p className="app-muted text-xs font-bold">{label}</p>
        <p className="app-text mt-1 text-xl font-black">{value}</p>
      </div>
    </div>
  );
}

function SkillGroup({ title, skills }: { title: string; skills: HrRecord[] }): JSX.Element {
  const text = useAppText();
  return (
    <div className="app-surface-muted app-border rounded-2xl border p-4">
      <p className="app-text text-sm font-black">{title}</p>
      {skills.length === 0 ? (
        <p className="app-muted mt-3 text-sm">Не указаны</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <RecruitmentBadge key={String(skill.id)} tone="accent">
              {String(skill.name)} · {String(skill.required_level ?? 0)}/10
            </RecruitmentBadge>
          ))}
        </div>
      )}
    </div>
  );
}

const vacancyStatusOptions = [
  { value: "open", label: "Открыта" },
  { value: "draft", label: "Черновик" },
  { value: "paused", label: "Приостановлена" },
  { value: "closed", label: "Закрыта" },
];
const employmentTypeOptions = [
  { value: "full_time", label: "Полная занятость" },
  { value: "part_time", label: "Частичная занятость" },
  { value: "temporary", label: "Временная работа" },
  { value: "internship", label: "Стажировка" },
];

function vacancyStatusLabel(value: string): string {
  return vacancyStatusOptions.find((item) => item.value === value)?.label ?? value;
}
function employmentTypeLabel(value: string): string {
  return employmentTypeOptions.find((item) => item.value === value)?.label ?? value;
}
function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
