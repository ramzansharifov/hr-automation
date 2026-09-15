import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
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
import { CandidateHireDialog } from "../../features/recruitment/CandidateHireDialog";
import {
  activeCandidateStages,
  candidateStatus,
  candidateStatusLabel,
  candidateStatusMeta,
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

const genderOptions: SelectOption[] = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
];

export function CandidateDetailsPage(): JSX.Element {
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
  const [hireOpen, setHireOpen] = useState(false);

  const loadProfile = useCallback(async (): Promise<void> => {
    if (!Number.isInteger(candidateId) || candidateId <= 0) {
      navigate("/candidates", { replace: true });
      return;
    }
    setIsLoading(true);
    try {
      const result = await hrApiClient.getCandidate(candidateId);
      if (!result) throw new Error("Кандидат не найден");
      setProfile(result);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось открыть кандидата"));
      navigate("/candidates", { replace: true });
    } finally {
      setIsLoading(false);
    }
  }, [candidateId, navigate]);

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
    return <LoadingState label="Загрузка карточки кандидата..." />;
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
      const saved = await hrApiClient.saveCandidate({
        id: candidateId,
        vacancyId: Number(candidate.vacancy_id),
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
      toast.success("Данные кандидата обновлены");
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось обновить кандидата"));
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
        "Кандидат переведён на этап «" +
          candidateStatusLabel(saved.candidate.status) +
          "»",
      );
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось перевести кандидата"));
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
      toast.success("Кандидат отклонён. История подбора сохранена");
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось отклонить кандидата"));
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
              К кандидатам
            </ActionButton>
            {canEdit && !isTerminalCandidateStatus(status) && (
              <ActionButton action="edit" onClick={openEdit} type="button">
                Редактировать данные
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
                Открыть сотрудника
              </ActionButton>
            )}
          </>
        }
        eyebrow="Кандидат"
        icon={<FiUser />}
        meta={
          <div className="flex flex-wrap gap-2">
            <RecruitmentBadge tone={candidateStatusTone(status)}>
              {candidateStatusLabel(status)}
            </RecruitmentBadge>
            <RecruitmentBadge tone="accent">
              Соответствие {match}%
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
                Профиль
              </p>
              <h2 className="app-text mt-1 text-xl font-black">
                Данные кандидата
              </h2>
            </div>
            {candidate.source && (
              <RecruitmentBadge>{String(candidate.source)}</RecruitmentBadge>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoItem
              icon={<FiPhone />}
              label="Телефон"
              value={text(candidate.phone) || "Не указан"}
            />
            <InfoItem
              icon={<FiMail />}
              label="Email"
              value={text(candidate.email) || "Не указан"}
            />
            <InfoItem
              icon={<FiUser />}
              label="Дата рождения"
              value={text(candidate.birth_date) || "Не указана"}
            />
            <InfoItem
              icon={<FiUser />}
              label="Пол"
              value={genderLabel(candidate.gender) || "Не указан"}
            />
            <InfoItem
              icon={<FiMapPin />}
              label="Адрес"
              value={candidateAddress(candidate) || "Не указан"}
            />
            <InfoItem
              icon={<FiClock />}
              label="Зарегистрирован"
              value={formatDateTime(candidate.created_at)}
            />
          </div>
        </article>

        <article className="app-surface app-border rounded-[24px] border p-5">
          <p className="app-accent-text text-xs font-black uppercase tracking-[0.12em]">
            Вакансия
          </p>
          <h2 className="app-text mt-1 text-xl font-black">
            {String(candidate.position_name ?? "—")}
          </h2>
          <div className="mt-4 space-y-3">
            <InfoLine label="Предприятие" value={text(candidate.enterprise_name)} />
            <InfoLine label="Отдел" value={text(candidate.department_name)} />
            <InfoLine
              label="Статус вакансии"
              value={vacancyStatusLabel(candidate.vacancy_status)}
            />
            <InfoLine
              label="Количество мест"
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
              Открыть вакансию
            </ActionButton>
          </div>
        </article>
      </section>

      <section className="app-surface app-border rounded-[24px] border p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.12em]">
              Оценка
            </p>
            <h2 className="app-text mt-1 text-xl font-black">
              Соответствие навыкам
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
              Следующее действие
            </p>
            <h2 className="app-text mt-1 text-xl font-black">
              {candidateStatusMeta[status].label}
            </h2>
            <p className="app-muted mt-2 max-w-3xl text-sm">
              {candidateStatusMeta[status].description}
            </p>
            {!vacancyOpen && isActiveCandidateStatus(status) && (
              <p className="mt-3 text-sm font-bold text-amber-600 dark:text-amber-400">
                Вакансия сейчас не открыта. Продвижение по этапам и приём
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
                Перевести: {candidateStatusLabel(nextStage)}
              </ActionButton>
            )}
            {canHireCandidate && (
              <ActionButton
                action="hire"
                onClick={() => setHireOpen(true)}
                type="button"
              >
                Принять на работу
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
                Отклонить
              </ActionButton>
            )}
          </div>
        </div>
      </section>

      <section className="app-surface app-border rounded-[24px] border p-5">
        <p className="app-accent-text text-xs font-black uppercase tracking-[0.12em]">
          История
        </p>
        <h2 className="app-text mt-1 text-xl font-black">
          Этапы подбора
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
                  {text(item.reason) || "Изменение этапа подбора"}
                </p>
              </div>
              <span className="app-muted text-xs font-bold">
                {formatDateTime(item.changed_at)}
              </span>
            </article>
          ))}
        </div>
      </section>

      {editForm && (
        <Dialog
          description="Здесь редактируются данные кандидата и оценки. Этап подбора меняется только отдельными действиями на карточке."
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) setEditForm(null);
          }}
          open={editOpen}
          size="lg"
          title="Редактировать кандидата"
        >
          <form className="grid gap-5" onSubmit={saveCandidate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <EditField
                label="Фамилия"
                onChange={(lastName) =>
                  setEditForm((current) =>
                    current ? { ...current, lastName } : current,
                  )
                }
                required
                value={editForm.lastName}
              />
              <EditField
                label="Имя"
                onChange={(firstName) =>
                  setEditForm((current) =>
                    current ? { ...current, firstName } : current,
                  )
                }
                required
                value={editForm.firstName}
              />
              <EditField
                label="Отчество"
                onChange={(middleName) =>
                  setEditForm((current) =>
                    current ? { ...current, middleName } : current,
                  )
                }
                value={editForm.middleName}
              />
              <EditField
                label="Дата рождения"
                onChange={(birthDate) =>
                  setEditForm((current) =>
                    current ? { ...current, birthDate } : current,
                  )
                }
                type="date"
                value={editForm.birthDate}
              />
              <FormField label="Пол">
                <Select
                  onValueChange={(gender) =>
                    setEditForm((current) =>
                      current ? { ...current, gender } : current,
                    )
                  }
                  options={genderOptions}
                  placeholder="Не указано"
                  value={editForm.gender}
                />
              </FormField>
              <EditField
                label="Телефон"
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
                label="Источник"
                onChange={(source) =>
                  setEditForm((current) =>
                    current ? { ...current, source } : current,
                  )
                }
                value={editForm.source}
              />
            </div>

            <section className="app-surface-muted app-border rounded-2xl border p-4">
              <h3 className="app-text font-black">Адрес</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <EditField
                  label="Страна"
                  onChange={(addressCountry) =>
                    setEditForm((current) =>
                      current ? { ...current, addressCountry } : current,
                    )
                  }
                  value={editForm.addressCountry}
                />
                <EditField
                  label="Город"
                  onChange={(addressCity) =>
                    setEditForm((current) =>
                      current ? { ...current, addressCity } : current,
                    )
                  }
                  value={editForm.addressCity}
                />
                <EditField
                  label="Улица"
                  onChange={(addressStreet) =>
                    setEditForm((current) =>
                      current ? { ...current, addressStreet } : current,
                    )
                  }
                  value={editForm.addressStreet}
                />
                <EditField
                  label="Дом"
                  onChange={(addressHouse) =>
                    setEditForm((current) =>
                      current ? { ...current, addressHouse } : current,
                    )
                  }
                  value={editForm.addressHouse}
                />
                <EditField
                  label="Квартира"
                  onChange={(addressApartment) =>
                    setEditForm((current) =>
                      current ? { ...current, addressApartment } : current,
                    )
                  }
                  value={editForm.addressApartment}
                />
              </div>
              <div className="mt-4">
                <FormField label="Адрес одной строкой">
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
                  <h3 className="app-text font-black">Оценка навыков</h3>
                  <p className="app-muted mt-1 text-xs">
                    Оценки можно уточнять по мере прохождения этапов.
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
                        Требуется: {skill.requiredLevel}/10
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
                Сохранить данные
              </ActionButton>
            </div>
          </form>
        </Dialog>
      )}

      {nextStage && (
        <Dialog
          description={
            "Статус изменится только на следующий этап: «" +
            candidateStatusLabel(status) +
            "» → «" +
            candidateStatusLabel(nextStage) +
            "»."
          }
          onOpenChange={setAdvanceOpen}
          open={advanceOpen}
          title={"Перевести на этап «" + candidateStatusLabel(nextStage) + "»"}
        >
          <form className="grid gap-4" onSubmit={advanceCandidate}>
            <FormField label="Комментарий к переходу">
              <Textarea
                onChange={(event) => setAdvanceReason(event.target.value)}
                placeholder="Например: резюме соответствует требованиям, интервью назначено..."
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
                Подтвердить переход
              </ActionButton>
            </div>
          </form>
        </Dialog>
      )}

      <Dialog
        description="Отказ завершает процесс подбора для этой карточки. Кандидат и вся история этапов останутся в системе."
        onOpenChange={setRejectOpen}
        open={rejectOpen}
        title="Отклонить кандидата"
      >
        <form className="grid gap-4" onSubmit={rejectCandidate}>
          <FormField label="Причина отказа">
            <Textarea
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Укажите основание решения"
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
              Отклонить кандидата
            </ActionButton>
          </div>
        </form>
      </Dialog>

      {canHire && (
        <CandidateHireDialog
          candidate={candidate}
          onHired={() => void loadProfile()}
          onOpenChange={setHireOpen}
          open={hireOpen}
        />
      )}
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
            Процесс подбора
          </p>
          <h2 className="app-text mt-1 text-xl font-black">
            Последовательные этапы
          </h2>
        </div>
        {status === "hired" && (
          <RecruitmentBadge tone="success">
            <span className="inline-flex items-center gap-1.5">
              <FiCheck />
              Найм завершён
            </span>
          </RecruitmentBadge>
        )}
        {status === "rejected" && (
          <RecruitmentBadge tone="neutral">
            <span className="inline-flex items-center gap-1.5">
              <FiXCircle />
              Подбор завершён отказом
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
                    {isCurrent ? "Текущий этап" : isReached ? "Пройден" : "Впереди"}
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
  const meets = skill.score >= skill.requiredLevel;
  return (
    <div className="app-surface-muted app-border rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-text font-black">{skill.name}</p>
          <p className="app-muted mt-1 text-xs">
            Требование: {skill.requiredLevel}/10
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

function candidateAddress(candidate: HrRecord): string {
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

function formatDateTime(value: unknown): string {
  const normalized = text(value);
  if (!normalized) return "—";
  const date = new Date(normalized.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime())
    ? normalized
    : date.toLocaleString("ru-RU");
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
