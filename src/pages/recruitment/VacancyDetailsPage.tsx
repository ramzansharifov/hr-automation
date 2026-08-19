import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiAward,
  FiBriefcase,
  FiEdit2,
  FiMail,
  FiPhone,
  FiPlus,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import {
  FormField,
  MatchBar,
  RecruitmentBadge,
} from "../../features/recruitment/RecruitmentUi";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord, VacancyProfile } from "../../shared/types/hr";
import {
  Button,
  Dialog,
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
  const navigate = useNavigate();
  const { id } = useParams();
  const vacancyId = Number(id);
  const { hasPermission } = useAuth();
  const canManage = hasPermission("recruitment.manage");

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
      const [vacancyProfile, candidateRows] = await Promise.all([
        hrApiClient.getVacancy(vacancyId),
        hrApiClient.listCandidates({}),
      ]);
      if (!vacancyProfile) throw new Error("Вакансия не найдена");
      setProfile(vacancyProfile);
      setCandidates(
        candidateRows.filter(
          (candidate) => Number(candidate.vacancy_id) === vacancyId,
        ),
      );
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить вакансию"));
      navigate("/vacancies", { replace: true });
    } finally {
      setIsLoading(false);
    }
  }, [navigate, vacancyId]);

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
    if (!canManage || !profile) return;
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
    if (!candidateDraft || !canManage) return;
    setIsSaving(true);
    try {
      await hrApiClient.saveCandidate({
        vacancyId,
        lastName: candidateDraft.lastName,
        firstName: candidateDraft.firstName,
        middleName: candidateDraft.middleName || undefined,
        phone: candidateDraft.phone || undefined,
        email: candidateDraft.email || undefined,
        source: candidateDraft.source || undefined,
        status: "new",
        skillScores: candidateDraft.skills.map((skill) => ({
          vacancySkillId: skill.vacancySkillId,
          score: skill.score,
        })),
      });
      setCandidateDraft(null);
      await loadData();
      toast.success("Кандидат добавлен к вакансии");
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось добавить кандидата"));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !profile) {
    return <LoadingState label="Загрузка вакансии..." />;
  }

  const vacancy = profile.vacancy;
  const title = String(vacancy.position_name ?? "Вакансия");

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button
              leftIcon={<FiArrowLeft className="h-4 w-4" />}
              onClick={() => navigate("/vacancies")}
              style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
              type="button"
              variant="ghost"
            >
              К списку
            </Button>
            {canManage && (
              <Button
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => navigate(`/vacancies/${vacancyId}/edit`)}
                style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
                type="button"
                variant="ghost"
              >
                Редактировать
              </Button>
            )}
            {canManage && (
              <Button
                leftIcon={<FiUserPlus className="h-4 w-4" />}
                onClick={openCandidateCreate}
                style={{ background: "#fff", color: "#0f172a" }}
                type="button"
                variant="ghost"
              >
                Добавить кандидата
              </Button>
            )}
          </>
        }
        description={
          [vacancy.enterprise_name, vacancy.department_name]
            .filter(Boolean)
            .join(" · ") || "Организационная структура не указана"
        }
        eyebrow="Вакансия"
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
              {String(vacancy.openings_count ?? 1)} мест
            </RecruitmentBadge>
          </div>
        }
        title={title}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FiUsers />} label="Кандидатов" value={String(candidates.length)} />
        <MetricCard icon={<FiAward />} label="Лучшее соответствие" value={`${Math.round(bestMatch)}%`} />
        <MetricCard icon={<FiBriefcase />} label="На этапе оффера" value={String(offerCount)} />
        <MetricCard icon={<FiUserPlus />} label="Принято" value={String(hiredCount)} />
      </div>

      <section className="app-surface app-border rounded-[28px] border p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.14em]">Профиль вакансии</p>
            <h2 className="app-text mt-1 text-xl font-black">Требования по навыкам</h2>
          </div>
          <p className="app-muted text-sm">Уровень показывает ожидаемое владение навыком по шкале 1–10.</p>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <SkillGroup title="Hard skills" skills={hardSkills} />
          <SkillGroup title="Soft skills" skills={softSkills} />
        </div>
      </section>

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.14em]">Подбор</p>
            <h2 className="app-text mt-1 text-2xl font-black">Кандидаты на вакансию</h2>
            <p className="app-muted mt-1 text-sm">
              Список автоматически отсортирован от наиболее подходящего кандидата к наименее подходящему.
            </p>
          </div>
          {canManage && (
            <Button leftIcon={<FiPlus />} onClick={openCandidateCreate} type="button">
              Добавить кандидата
            </Button>
          )}
        </div>

        {rankedCandidates.length === 0 ? (
          <div className="py-16">
            <EmptyState
              title="Кандидатов пока нет"
              description={
                canManage
                  ? "Добавьте первого кандидата и оцените его навыки относительно требований этой вакансии."
                  : "К этой вакансии пока не добавлены кандидаты."
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 p-5 xl:grid-cols-2">
            {rankedCandidates.map((candidate, index) => (
              <CandidateRankCard
                candidate={candidate}
                isBest={index === 0 && Number(candidate.match_percentage ?? 0) > 0}
                key={String(candidate.id)}
                onOpen={() => navigate(`/candidates?candidate=${String(candidate.id)}`)}
                rank={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      {candidateDraft && (
        <Dialog
          description={`Кандидат будет сразу привязан к вакансии «${title}». Оцените навыки по шкале 0–10.`}
          footer={
            <div className="flex justify-end gap-3">
              <Button onClick={() => setCandidateDraft(null)} type="button" variant="secondary">
                Отмена
              </Button>
              <Button
                disabled={
                  isSaving ||
                  !candidateDraft.lastName.trim() ||
                  !candidateDraft.firstName.trim()
                }
                onClick={() => {
                  const form = document.getElementById("vacancy-candidate-form") as HTMLFormElement | null;
                  form?.requestSubmit();
                }}
                type="button"
              >
                {isSaving ? "Сохранение..." : "Добавить кандидата"}
              </Button>
            </div>
          }
          onOpenChange={(open) => !open && setCandidateDraft(null)}
          open
          size="lg"
          title="Новый кандидат"
        >
          <form className="grid gap-5" id="vacancy-candidate-form" onSubmit={saveCandidate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Фамилия">
                <Input
                  autoFocus
                  onChange={(event) => setCandidateDraft((current) => current ? { ...current, lastName: event.target.value } : current)}
                  required
                  value={candidateDraft.lastName}
                />
              </FormField>
              <FormField label="Имя">
                <Input
                  onChange={(event) => setCandidateDraft((current) => current ? { ...current, firstName: event.target.value } : current)}
                  required
                  value={candidateDraft.firstName}
                />
              </FormField>
              <FormField label="Отчество">
                <Input
                  onChange={(event) => setCandidateDraft((current) => current ? { ...current, middleName: event.target.value } : current)}
                  value={candidateDraft.middleName}
                />
              </FormField>
              <FormField label="Источник">
                <Input
                  onChange={(event) => setCandidateDraft((current) => current ? { ...current, source: event.target.value } : current)}
                  placeholder="Сайт, рекомендация, соцсеть"
                  value={candidateDraft.source}
                />
              </FormField>
              <FormField label="Телефон">
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
                      aria-label={`Оценка навыка ${skill.name}`}
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

function CandidateRankCard({
  candidate,
  isBest,
  onOpen,
  rank,
}: {
  candidate: HrRecord;
  isBest: boolean;
  onOpen: () => void;
  rank: number;
}): JSX.Element {
  const name = [candidate.last_name, candidate.first_name, candidate.middle_name]
    .filter(Boolean)
    .join(" ");
  const match = Number(candidate.match_percentage ?? 0);
  const skillRows = String(candidate.skills_summary ?? "")
    .split(String.fromCharCode(31))
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <article className="app-surface app-border rounded-[24px] border p-5 transition hover:border-[var(--accent-border)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="app-accent-soft app-accent-text flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black">
            #{rank}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="app-text truncate text-lg font-black">{name || "Кандидат"}</h3>
              {isBest && (
                <RecruitmentBadge tone="success">Лучшее соответствие</RecruitmentBadge>
              )}
            </div>
            <div className="app-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
              {candidate.phone && <span className="flex items-center gap-1.5"><FiPhone />{String(candidate.phone)}</span>}
              {candidate.email && <span className="flex items-center gap-1.5"><FiMail />{String(candidate.email)}</span>}
            </div>
          </div>
        </div>
        <RecruitmentBadge tone={candidate.status === "hired" ? "success" : candidate.status === "offer" ? "warning" : "neutral"}>
          {candidateStatusLabel(String(candidate.status))}
        </RecruitmentBadge>
      </div>

      <div className="mt-5">
        <MatchBar value={match} />
      </div>

      {skillRows.length > 0 && (
        <div className="app-border-soft mt-4 border-t pt-4">
          <p className="app-muted mb-2 text-xs font-black uppercase tracking-[0.12em]">Навыки</p>
          <div className="flex flex-wrap gap-2">
            {skillRows.slice(0, 4).map((skill) => (
              <RecruitmentBadge key={skill}>{skill}</RecruitmentBadge>
            ))}
            {skillRows.length > 4 && <RecruitmentBadge>+{skillRows.length - 4}</RecruitmentBadge>}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button onClick={onOpen} type="button" variant="secondary">
          Открыть карточку
        </Button>
      </div>
    </article>
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
const candidateStatusOptions = [
  { value: "new", label: "Новый" },
  { value: "screening", label: "Первичный отбор" },
  { value: "interview", label: "Собеседование" },
  { value: "offer", label: "Оффер" },
  { value: "hired", label: "Принят" },
  { value: "rejected", label: "Отклонён" },
];

function vacancyStatusLabel(value: string): string {
  return vacancyStatusOptions.find((item) => item.value === value)?.label ?? value;
}
function employmentTypeLabel(value: string): string {
  return employmentTypeOptions.find((item) => item.value === value)?.label ?? value;
}
function candidateStatusLabel(value: string): string {
  return candidateStatusOptions.find((item) => item.value === value)?.label ?? value;
}
function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
