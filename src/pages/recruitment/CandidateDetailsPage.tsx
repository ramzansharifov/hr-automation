import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheck,
  FiClock,
  FiMail,
  FiMapPin,
  FiPhone,
  FiUser,
  FiXCircle,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import {
  activeCandidateStages,
  candidateStatus,
  candidateStatusDescription,
  candidateStatusLabel,
  candidateStatusTone,
  isActiveCandidateStatus,
  isTerminalCandidateStatus,
  nextCandidateStage,
} from "../../features/recruitment/candidateWorkflow";
import {
  FormField,
  MatchBar,
  RecruitmentBadge,
} from "../../features/recruitment/RecruitmentUi";
import { useAppLocale, useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  CandidateProfile,
  CandidateStatus,
  HrRecord,
} from "../../shared/types/hr";
import {
  ActionButton,
  Dialog,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
  type SelectOption,
} from "../../shared/ui";

interface CandidateSkillState {
  vacancySkillId: number;
  name: string;
  requiredLevel: number;
  score: number;
}

interface CandidateEditState {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: string;
  phone: string;
  email: string;
  addressCountry: string;
  addressCity: string;
  addressStreet: string;
  addressHouse: string;
  addressApartment: string;
  address: string;
  source: string;
  skills: CandidateSkillState[];
}

export function CandidateDetailsPage(): JSX.Element {
  const tr = useAppText();
  const locale = useAppLocale();
  const genderOptions: SelectOption[] = [
    { value: "male", label: tr("Мужской", "Male") },
    { value: "female", label: tr("Женский", "Female") },
  ];
  const navigate = useNavigate();
  const { id } = useParams();
  const candidateId = Number(id);
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("candidates.edit");
  const canHire = hasPermission("candidates.hire");
  const canViewEmployee =
    hasPermission("employees.view") || hasPermission("profile.view");

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<CandidateEditState | null>(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceReason, setAdvanceReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const loadProfile = useCallback(async (): Promise<void> => {
    if (!Number.isInteger(candidateId) || candidateId <= 0) {
      navigate("/candidates", { replace: true });
      return;
    }
    setIsLoading(true);
    try {
      const result = await hrApiClient.getCandidate(candidateId);
      if (!result) throw new Error(tr("Кандидат не найден", "Candidate not found"));
      setProfile(result);
    } catch (error) {
      toast.error(errorMessage(error, tr("Не удалось открыть кандидата", "Failed to open candidate")));
      navigate("/candidates", { replace: true });
    } finally {
      setIsLoading(false);
    }
  }, [candidateId, navigate, tr]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const candidate = profile?.candidate ?? null;
  const status = candidateStatus(candidate?.status);
  const nextStage = nextCandidateStage(status);
  const vacancyOpen =
    candidate?.vacancy_status === "open" &&
    Number(candidate?.vacancy_is_archived ?? 0) !== 1;

  const skillScores = useMemo(
    () =>
      new Map(
        (profile?.skillScores ?? []).map((score) => [
          Number(score.vacancy_skill_id),
          Number(score.score ?? 0),
        ]),
      ),
    [profile],
  );

  const skills = useMemo<CandidateSkillState[]>(
    () =>
      (profile?.vacancySkills ?? []).map((skill) => ({
        vacancySkillId: Number(skill.id),
        name: String(skill.name ?? ""),
        requiredLevel: Number(skill.required_level ?? 1),
        score: skillScores.get(Number(skill.id)) ?? 0,
      })),
    [profile, skillScores],
  );

  const match = useMemo(() => calculateMatch(skills), [skills]);

  if (isLoading || !profile || !candidate) {
    return <LoadingState label={tr("Загрузка карточки кандидата...", "Loading candidate profile...")} />;
  }

  const canManageActive =
    canEdit && isActiveCandidateStatus(status) && !candidate.employee_id;
  const canAdvance =
    canManageActive && vacancyOpen && nextStage !== null;
  const canReject = canManageActive;
  const canHireCandidate =
    canHire &&
    vacancyOpen &&
    status === "offer" &&
    !candidate.employee_id;

  function openEdit(): void {
    if (!canEdit || isTerminalCandidateStatus(status)) return;
    setEditForm(profileToEditState(profile!));
    setEditOpen(true);
  }

  async function saveCandidate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!editForm || !canEdit) return;
    setIsSaving(true);
    try {
      const currentCandidate = profile!.candidate;
      const saved = await hrApiClient.saveCandidate({
        id: candidateId,
        vacancyId: Number(currentCandidate.vacancy_id),
        lastName: editForm.lastName,
        firstName: editForm.firstName,
        middleName: optional(editForm.middleName),
        birthDate: optional(editForm.birthDate),
        gender: optional(editForm.gender),
        phone: optional(editForm.phone),
        email: optional(editForm.email),
        addressCountry: optional(editForm.addressCountry),
        addressCity: optional(editForm.addressCity),
        addressStreet: optional(editForm.addressStreet),
        addressHouse: optional(editForm.addressHouse),
        addressApartment: optional(editForm.addressApartment),
        address: optional(editForm.address),
        source: optional(editForm.source),
        skillScores: editForm.skills.map((skill) => ({
          vacancySkillId: skill.vacancySkillId,
          score: skill.score,
        })),
      });
      setProfile(saved);
      setEditOpen(false);
      toast.success(tr("Данные кандидата обновлены", "Candidate data updated"));
    } catch (error) {
      toast.error(errorMessage(error, tr("Не удалось обновить кандидата", "Failed to update candidate")));
    } finally {
      setIsSaving(false);
    }
  }

  async function advanceCandidate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canAdvance) return;
    setIsSaving(true);
    try {
      const saved = await hrApiClient.advanceCandidate({
        candidateId,
        reason: optional(advanceReason),
      });
      setProfile(saved);
      setAdvanceOpen(false);
      setAdvanceReason("");
      toast.success(
        tr("Кандидат переведён на этап «", "Candidate moved to stage “") +
          candidateStatusLabel(saved.candidate.status) +
          tr("»", "”"),
      );
    } catch (error) {
      toast.error(errorMessage(error, tr("Не удалось перевести кандидата", "Failed to advance candidate")));
    } finally {
      setIsSaving(false);
    }
  }

  async function rejectCandidate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canReject || !rejectReason.trim()) return;
    setIsSaving(true);
    try {
      const saved = await hrApiClient.rejectCandidate({
        candidateId,
        reason: rejectReason.trim(),
      });
      setProfile(saved);
      setRejectOpen(false);
      setRejectReason("");
      toast.success(tr("Кандидат отклонён. История подбора сохранена", "Candidate rejected. Recruitment history preserved"));
    } catch (error) {
      toast.error(errorMessage(error, tr("Не удалось отклонить кандидата", "Failed to reject candidate")));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <ActionButton
              action="back"
              onClick={() => navigate("/candidates")}
              type="button"
            >
              {tr("К кандидатам", "Back to candidates")}
            </ActionButton>
            {canEdit && !isTerminalCandidateStatus(status) && (
              <ActionButton action="edit" onClick={openEdit} type="button">
                {tr("Редактировать данные", "Edit data")}
              </ActionButton>
            )}
            {candidate.employee_id && canViewEmployee && (
              <ActionButton
                action="open"
                onClick={() =>
                  navigate("/employees/" + String(candidate.employee_id))
                }
                type="button"
              >
                {tr("Открыть сотрудника", "Open employee")}
              </ActionButton>
            )}
          </>
        }
        eyebrow={tr("Кандидат", "Candidate")}
        icon={<FiUser />}
        meta={
          <div className="flex flex-wrap gap-2">
            <RecruitmentBadge tone={candidateStatusTone(status)}>
              {candidateStatusLabel(status)}
            </RecruitmentBadge>
            <RecruitmentBadge tone="accent">
              {tr("Соответствие", "Match")} {match}%
            </RecruitmentBadge>
          </div>
        }
        title={fullName(candidate)}
      />

      <CandidateWorkflow
        history={profile.statusHistory}
        status={status}
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <article className="app-surface app-border rounded-[24px] border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="app-accent-text text-xs font-black uppercase tracking-[0.12em]">
                {tr("Профиль", "Profile")}
              </p>
              <h2 className="app-text mt-1 text-xl font-black">
                {tr("Данные кандидата", "Candidate data")}
              </h2>
            </div>
            {candidate.source && (
              <RecruitmentBadge>{String(candidate.source)}</RecruitmentBadge>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoItem
              icon={<FiPhone />}
              label={tr("Телефон", "Phone")}
              value={text(candidate.phone) || tr("Не указан", "Not specified")}
            />
            <InfoItem
              icon={<FiMail />}
              label="Email"
              value={text(candidate.email) || tr("Не указан", "Not specified")}
            />
            <InfoItem
              icon={<FiUser />}
              label={tr("Дата рождения", "Date of birth")}
              value={text(candidate.birth_date) || tr("Не указана", "Not specified")}
            />
            <InfoItem
              icon={<FiUser />}
              label={tr("Пол", "Gender")}
              value={genderLabel(candidate.gender, tr) || tr("Не указан", "Not specified")}
            />
            <InfoItem
              icon={<FiMapPin />}
              label={tr("Адрес", "Address")}
              value={candidateAddress(candidate, tr) || tr("Не указан", "Not specified")}
            />
            <InfoItem
              icon={<FiClock />}
              label={tr("Зарегистрирован", "Registered")}
              value={formatDateTime(candidate.created_at, locale)}
            />
          </div>
        </article>

        <article className="app-surface app-border rounded-[24px] border p-5">
          <p className="app-accent-text text-xs font-black uppercase tracking-[0.12em]">
            {tr("Вакансия", "Vacancy")}
          </p>
          <h2 className="app-text mt-1 text-xl font-black">
            {String(candidate.position_name ?? "—")}
          </h2>
          <div className="mt-4 space-y-3">
            <InfoLine label={tr("Предприятие", "Enterprise")} value={text(candidate.enterprise_name)} />
            <InfoLine label={tr("Отдел", "Department")} value={text(candidate.department_name)} />
            <InfoLine
              label={tr("Статус вакансии", "Vacancy status")}
              value={vacancyStatusLabel(candidate.vacancy_status)}
            />
            <InfoLine
              label={tr("Количество мест", "Openings")}
              value={String(candidate.vacancy_openings_count ?? "—")}
            />
          </div>
          <div className="mt-5">
            <ActionButton
              action="open"
              onClick={() =>
                navigate("/vacancies/" + String(candidate.vacancy_id))
              }
              type="button"
            >
              {tr("Открыть вакансию", "Open vacancy")}
            </ActionButton>
          </div>
        </article>
      </section>

      <section className="app-surface app-border rounded-[24px] border p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.12em]">
              {tr("Оценка", "Assessment")}
            </p>
            <h2 className="app-text mt-1 text-xl font-black">
              {tr("Соответствие навыкам", "Skill match")}
            </h2>
          </div>
          <div className="w-full sm:max-w-[260px]">
            <MatchBar value={match} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {skills.map((skill) => (
            <SkillScore key={skill.vacancySkillId} skill={skill} />
          ))}
        </div>
      </section>

      <section className="app-surface app-border rounded-[24px] border p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.12em]">
              {tr("Следующее действие", "Next action")}
            </p>
            <h2 className="app-text mt-1 text-xl font-black">
              {candidateStatusLabel(status)}
            </h2>
            <p className="app-muted mt-2 max-w-3xl text-sm">
              {candidateStatusDescription(status)}
            </p>
            {!vacancyOpen && isActiveCandidateStatus(status) && (
              <p className="mt-3 text-sm font-bold text-amber-600 dark:text-amber-400">
                {tr("Вакансия", "Vacancy")} сейчас не открыта. Продвижение по этапам и приём
                недоступны до её повторного открытия.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {canAdvance && nextStage && (
              <ActionButton
                action="next"
                onClick={() => {
                  setAdvanceReason("");
                  setAdvanceOpen(true);
                }}
                type="button"
              >
                {tr("Перевести:", "Advance to:")} {candidateStatusLabel(nextStage)}
              </ActionButton>
            )}
            {canHireCandidate && (
              <ActionButton
                action="hire"
                onClick={() => navigate(`/candidates/${candidateId}/hire`)}
                type="button"
              >
                {tr("Принять на работу", "Hire")}
              </ActionButton>
            )}
            {canReject && (
              <ActionButton
                action="delete"
                onClick={() => {
                  setRejectReason("");
                  setRejectOpen(true);
                }}
                type="button"
              >
                {tr("Отклонить", "Reject")}
              </ActionButton>
            )}
          </div>
        </div>
      </section>

      <section className="app-surface app-border rounded-[24px] border p-5">
        <p className="app-accent-text text-xs font-black uppercase tracking-[0.12em]">
          {tr("История", "History")}
        </p>
        <h2 className="app-text mt-1 text-xl font-black">
          {tr("Этапы подбора", "Recruitment stages")}
        </h2>
        <div className="mt-5 space-y-3">
          {[...profile.statusHistory].reverse().map((item) => (
            <article
              className="app-surface-muted app-border grid gap-2 rounded-xl border px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={String(item.id)}
            >
              <div>
                <p className="app-text font-bold">
                  {candidateStatusLabel(item.new_status)}
                </p>
                <p className="app-muted mt-1 text-sm">
                  {text(item.reason) || tr("Изменение этапа подбора", "Recruitment stage change")}
                </p>
              </div>
              <span className="app-muted text-xs font-bold">
                {formatDateTime(item.changed_at, locale)}
              </span>
            </article>
          ))}
        </div>
      </section>

      {editForm && (
        <Dialog
          description={tr("Здесь редактируются данные кандидата и оценки. Этап подбора меняется только отдельными действиями на карточке.", "Edit candidate data and scores here. Recruitment stages are changed only through dedicated profile actions.")}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) setEditForm(null);
          }}
          open={editOpen}
          size="lg"
          title={tr("Редактировать кандидата", "Edit candidate")}
        >
          <form className="grid gap-5" onSubmit={saveCandidate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <EditField
                label={tr("Фамилия", "Last name")}
                onChange={(lastName) =>
                  setEditForm((current) =>
                    current ? { ...current, lastName } : current,
                  )
                }
                required
                value={editForm.lastName}
              />
              <EditField
                label={tr("Имя", "First name")}
                onChange={(firstName) =>
                  setEditForm((current) =>
                    current ? { ...current, firstName } : current,
                  )
                }
                required
                value={editForm.firstName}
              />
              <EditField
                label={tr("Отчество", "Middle name")}
                onChange={(middleName) =>
                  setEditForm((current) =>
                    current ? { ...current, middleName } : current,
                  )
                }
                value={editForm.middleName}
              />
              <EditField
                label={tr("Дата рождения", "Date of birth")}
                onChange={(birthDate) =>
                  setEditForm((current) =>
                    current ? { ...current, birthDate } : current,
                  )
                }
                type="date"
                value={editForm.birthDate}
              />
              <FormField label={tr("Пол", "Gender")}>
                <Select
                  onValueChange={(gender) =>
                    setEditForm((current) =>
                      current ? { ...current, gender } : current,
                    )
                  }
                  options={genderOptions}
                  placeholder={tr("Не указано", "Not specified")}
                  value={editForm.gender}
                />
              </FormField>
              <EditField
                label={tr("Телефон", "Phone")}
                onChange={(phone) =>
                  setEditForm((current) =>
                    current ? { ...current, phone } : current,
                  )
                }
                type="tel"
                value={editForm.phone}
              />
              <EditField
                label="Email"
                onChange={(email) =>
                  setEditForm((current) =>
                    current ? { ...current, email } : current,
                  )
                }
                type="email"
                value={editForm.email}
              />
              <EditField
                label={tr("Источник", "Source")}
                onChange={(source) =>
                  setEditForm((current) =>
                    current ? { ...current, source } : current,
                  )
                }
                value={editForm.source}
              />
            </div>

            <section className="app-surface-muted app-border rounded-2xl border p-4">
              <h3 className="app-text font-black">{tr("Адрес", "Address")}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <EditField
                  label={tr("Страна", "Country")}
                  onChange={(addressCountry) =>
                    setEditForm((current) =>
                      current ? { ...current, addressCountry } : current,
                    )
                  }
                  value={editForm.addressCountry}
                />
                <EditField
                  label={tr("Город", "City")}
                  onChange={(addressCity) =>
                    setEditForm((current) =>
                      current ? { ...current, addressCity } : current,
                    )
                  }
                  value={editForm.addressCity}
                />
                <EditField
                  label={tr("Улица", "Street")}
                  onChange={(addressStreet) =>
                    setEditForm((current) =>
                      current ? { ...current, addressStreet } : current,
                    )
                  }
                  value={editForm.addressStreet}
                />
                <EditField
                  label={tr("Дом", "House")}
                  onChange={(addressHouse) =>
                    setEditForm((current) =>
                      current ? { ...current, addressHouse } : current,
                    )
                  }
                  value={editForm.addressHouse}
                />
                <EditField
                  label={tr("Квартира", "Apartment")}
                  onChange={(addressApartment) =>
                    setEditForm((current) =>
                      current ? { ...current, addressApartment } : current,
                    )
                  }
                  value={editForm.addressApartment}
                />
              </div>
              <div className="mt-4">
                <FormField label={tr("Адрес одной строкой", "Full address")}>
                  <Textarea
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, address: event.target.value }
                          : current,
                      )
                    }
                    value={editForm.address}
                  />
                </FormField>
              </div>
            </section>

            <section className="app-surface-muted app-border rounded-2xl border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="app-text font-black">{tr("Оценка навыков", "Skill assessment")}</h3>
                  <p className="app-muted mt-1 text-xs">
                    {tr("Оценки можно уточнять по мере прохождения этапов.", "Scores can be refined as the candidate progresses through stages.")}
                  </p>
                </div>
                <MatchBar value={calculateMatch(editForm.skills)} />
              </div>
              <div className="mt-4 space-y-3">
                {editForm.skills.map((skill) => (
                  <div
                    className="app-surface app-border grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_110px] sm:items-center"
                    key={skill.vacancySkillId}
                  >
                    <div>
                      <p className="app-text font-bold">{skill.name}</p>
                      <p className="app-muted mt-1 text-xs">
                        {tr("Требуется:", "Required:")} {skill.requiredLevel}/10
                      </p>
                    </div>
                    <Input
                      max="10"
                      min="0"
                      onChange={(event) => {
                        const score = Number(event.target.value);
                        setEditForm((current) =>
                          current
                            ? {
                                ...current,
                                skills: current.skills.map((item) =>
                                  item.vacancySkillId === skill.vacancySkillId
                                    ? { ...item, score }
                                    : item,
                                ),
                              }
                            : current,
                        );
                      }}
                      required
                      type="number"
                      value={skill.score}
                    />
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-3">
              <ActionButton
                action="cancel"
                onClick={() => {
                  setEditOpen(false);
                  setEditForm(null);
                }}
                type="button"
              />
              <ActionButton action="save" loading={isSaving} type="submit">
                {tr("Сохранить данные", "Save data")}
              </ActionButton>
            </div>
          </form>
        </Dialog>
      )}

      {nextStage && (
        <Dialog
          description={
            tr(
              `Статус изменится только на следующий этап: «${candidateStatusLabel(status)}» → «${candidateStatusLabel(nextStage)}».`,
              `Status will advance only to the next stage: “${candidateStatusLabel(status)}” → “${candidateStatusLabel(nextStage)}”.`,
            )
          }
          onOpenChange={setAdvanceOpen}
          open={advanceOpen}
          title={tr(
            `Перевести на этап «${candidateStatusLabel(nextStage)}»`,
            `Advance to “${candidateStatusLabel(nextStage)}”`,
          )}
        >
          <form className="grid gap-4" onSubmit={advanceCandidate}>
            <FormField label={tr("Комментарий к переходу", "Transition comment")}>
              <Textarea
                onChange={(event) => setAdvanceReason(event.target.value)}
                placeholder={tr("Например: резюме соответствует требованиям, интервью назначено...", "For example: resume meets requirements, interview scheduled...")}
                value={advanceReason}
              />
            </FormField>
            <div className="flex justify-end gap-3">
              <ActionButton
                action="cancel"
                onClick={() => setAdvanceOpen(false)}
                type="button"
              />
              <ActionButton action="next" loading={isSaving} type="submit">
                {tr("Подтвердить переход", "Confirm transition")}
              </ActionButton>
            </div>
          </form>
        </Dialog>
      )}

      <Dialog
        description={tr("Отказ завершает процесс подбора для этой карточки. Кандидат и вся история этапов останутся в системе.", "Rejection ends recruitment for this profile. The candidate and full stage history remain in the system.")}
        onOpenChange={setRejectOpen}
        open={rejectOpen}
        title={tr("Отклонить кандидата", "Reject candidate")}
      >
        <form className="grid gap-4" onSubmit={rejectCandidate}>
          <FormField label={tr("Причина отказа", "Rejection reason")}>
            <Textarea
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder={tr("Укажите основание решения", "Specify the reason for the decision")}
              required
              value={rejectReason}
            />
          </FormField>
          <div className="flex justify-end gap-3">
            <ActionButton
              action="cancel"
              onClick={() => setRejectOpen(false)}
              type="button"
            />
            <ActionButton
              action="delete"
              disabled={!rejectReason.trim()}
              loading={isSaving}
              type="submit"
            >
              {tr("Отклонить кандидата", "Reject candidate")}
            </ActionButton>
          </div>
        </form>
      </Dialog>

    </div>
  );
}

function CandidateWorkflow({
  history,
  status,
}: {
  history: HrRecord[];
  status: CandidateStatus;
}): JSX.Element {
  const tr = useAppText();
  const reached = new Set(
    history
      .map((item) => candidateStatus(item.new_status))
      .filter((item) => activeCandidateStages.some((stage) => stage === item)),
  );
  const currentActiveIndex = activeCandidateStages.findIndex(
    (stage) => stage === status,
  );

  return (
    <section className="app-surface app-border rounded-[24px] border p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="app-accent-text text-xs font-black uppercase tracking-[0.12em]">
            {tr("Процесс подбора", "Recruitment process")}
          </p>
          <h2 className="app-text mt-1 text-xl font-black">
            {tr("Последовательные этапы", "Sequential stages")}
          </h2>
        </div>
        {status === "hired" && (
          <RecruitmentBadge tone="success">
            <span className="inline-flex items-center gap-1.5">
              <FiCheck />
              {tr("Найм завершён", "Hiring completed")}
            </span>
          </RecruitmentBadge>
        )}
        {status === "rejected" && (
          <RecruitmentBadge tone="neutral">
            <span className="inline-flex items-center gap-1.5">
              <FiXCircle />
              {tr("Подбор завершён отказом", "Recruitment ended with rejection")}
            </span>
          </RecruitmentBadge>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {activeCandidateStages.map((stage, index) => {
          const isCurrent = status === stage;
          const isReached =
            reached.has(stage) ||
            (currentActiveIndex >= 0 && index <= currentActiveIndex) ||
            status === "hired";
          return (
            <div
              className={[
                "rounded-xl border p-4",
                isCurrent
                  ? "border-[var(--accent-border)] app-accent-soft"
                  : isReached
                    ? "border-emerald-500/25 bg-emerald-500/8"
                    : "app-border app-surface-muted",
              ].join(" ")}
              key={stage}
            >
              <div className="flex items-center gap-3">
                <span
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black",
                    isReached
                      ? "bg-emerald-500/12 text-emerald-500"
                      : "app-surface app-muted",
                  ].join(" ")}
                >
                  {isReached && !isCurrent ? <FiCheck /> : index + 1}
                </span>
                <div>
                  <p className="app-text text-sm font-black">
                    {candidateStatusLabel(stage)}
                  </p>
                  <p className="app-muted mt-0.5 text-[11px]">
                    {isCurrent ? tr("Текущий этап", "Current stage") : isReached ? tr("Пройден", "Completed") : tr("Впереди", "Upcoming")}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SkillScore({ skill }: { skill: CandidateSkillState }): JSX.Element {
  const tr = useAppText();
  const meets = skill.score >= skill.requiredLevel;
  return (
    <div className="app-surface-muted app-border rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-text font-black">{skill.name}</p>
          <p className="app-muted mt-1 text-xs">
            {tr("Требование:", "Requirement:")} {skill.requiredLevel}/10
          </p>
        </div>
        <RecruitmentBadge tone={meets ? "success" : "warning"}>
          {skill.score}/10
        </RecruitmentBadge>
      </div>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="app-surface-muted app-border flex items-start gap-3 rounded-xl border p-3">
      <span className="app-accent-soft app-accent-text flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="app-muted text-[11px] font-bold uppercase tracking-wide">
          {label}
        </p>
        <p className="app-text mt-1 break-words text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="app-border-soft flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
      <span className="app-muted text-sm font-semibold">{label}</span>
      <span className="app-text text-right text-sm font-bold">{value || "—"}</span>
    </div>
  );
}

function EditField({
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}): JSX.Element {
  return (
    <FormField label={label}>
      <Input
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </FormField>
  );
}

function profileToEditState(profile: CandidateProfile): CandidateEditState {
  const candidate = profile.candidate;
  const scores = new Map(
    profile.skillScores.map((score) => [
      Number(score.vacancy_skill_id),
      Number(score.score ?? 0),
    ]),
  );
  return {
    lastName: text(candidate.last_name),
    firstName: text(candidate.first_name),
    middleName: text(candidate.middle_name),
    birthDate: text(candidate.birth_date),
    gender: text(candidate.gender),
    phone: text(candidate.phone),
    email: text(candidate.email),
    addressCountry: text(candidate.address_country),
    addressCity: text(candidate.address_city),
    addressStreet: text(candidate.address_street),
    addressHouse: text(candidate.address_house),
    addressApartment: text(candidate.address_apartment),
    address: text(candidate.address),
    source: text(candidate.source),
    skills: profile.vacancySkills.map((skill) => ({
      vacancySkillId: Number(skill.id),
      name: text(skill.name),
      requiredLevel: Number(skill.required_level ?? 1),
      score: scores.get(Number(skill.id)) ?? 0,
    })),
  };
}

function calculateMatch(skills: CandidateSkillState[]): number {
  if (skills.length === 0) return 0;
  const points = skills.reduce(
    (sum, skill) =>
      sum + Math.min(skill.score / Math.max(skill.requiredLevel, 1), 1),
    0,
  );
  return Math.round((points / skills.length) * 100);
}

function fullName(candidate: HrRecord): string {
  return [candidate.last_name, candidate.first_name, candidate.middle_name]
    .map(text)
    .filter(Boolean)
    .join(" ") || "Без имени";
}

function candidateAddress(
  candidate: HrRecord,
  tr: (ru: string, en: string) => string,
): string {
  if (text(candidate.address)) return text(candidate.address);
  const locality = [candidate.address_country, candidate.address_city]
    .map(text)
    .filter(Boolean)
    .join(", ");
  const street = [
    text(candidate.address_street),
    text(candidate.address_house)
      ? "д. " + text(candidate.address_house)
      : "",
    text(candidate.address_apartment)
      ? "кв. " + text(candidate.address_apartment)
      : "",
  ]
    .filter(Boolean)
    .join(", ");
  return [locality, street].filter(Boolean).join(", ");
}

function vacancyStatusLabel(value: unknown): string {
  const labels: Record<string, string> = {
    draft: "Черновик",
    open: "Открыта",
    paused: "Приостановлена",
    closed: "Закрыта",
  };
  return labels[text(value)] ?? (text(value) || "—");
}

function genderLabel(value: unknown): string {
  if (value === "male") return "Мужской";
  if (value === "female") return "Женский";
  return text(value);
}

function formatDateTime(value: unknown, locale: string): string {
  const normalized = text(value);
  if (!normalized) return "—";
  const date = new Date(normalized.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime())
    ? normalized
    : date.toLocaleString(locale);
}

function optional(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
