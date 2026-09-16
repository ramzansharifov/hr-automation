import { useCallback, useEffect, useMemo, useState } from "react";
import { FiUserPlus } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import {
  candidateStatusLabel,
  candidateStatusTone,
} from "../../features/recruitment/candidateWorkflow";
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
import { useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord } from "../../shared/types/hr";
import {
  ActionButton,
  DataTable,
  DeleteConfirmDialog,
  Dialog,
  FormActions,
  Input,
  Select,
  type DataTableColumn,
  type SelectOption,
} from "../../shared/ui";

interface CandidateSkillDraft {
  vacancySkillId: number;
  name: string;
  requiredLevel: number;
  score: number;
}

interface CandidateDraft {
  vacancyId: string;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  phone: string;
  email: string;
  source: string;
  skills: CandidateSkillDraft[];
}

const emptyCandidate = (): CandidateDraft => ({
  vacancyId: "",
  lastName: "",
  firstName: "",
  middleName: "",
  birthDate: "",
  phone: "",
  email: "",
  source: "",
  skills: [],
});

export function CandidatesPage(): JSX.Element {
  const text = useAppText();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canViewVacancies = hasPermission("vacancies.view");
  const canCreate = hasPermission("candidates.create") && canViewVacancies;
  const canDelete = hasPermission("candidates.delete");

  const [candidates, setCandidates] = useState<HrRecord[]>([]);
  const [vacancies, setVacancies] = useState<HrRecord[]>([]);
  const [filters, setFilters] = useState<CandidateFilterValues>(
    getStoredCandidateFilterValues,
  );
  const [draft, setDraft] = useState<CandidateDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const filteredCandidates = useMemo(
    () => filterCandidates(candidates, filters),
    [candidates, filters],
  );

  const openVacancies = useMemo(
    () =>
      vacancies.filter(
        (vacancy) =>
          String(vacancy.status) === "open" &&
          Number(vacancy.is_archived ?? 0) !== 1,
      ),
    [vacancies],
  );

  const vacancyOptions = useMemo<SelectOption[]>(
    () =>
      openVacancies.map((vacancy) => ({
        value: String(vacancy.id),
        label:
          [vacancy.enterprise_name, vacancy.department_name, vacancy.position_name]
            .filter(Boolean)
            .join(" · ") || text("Вакансия #", "Vacancy #") + String(vacancy.id),
      })),
    [openVacancies, text],
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
      toast.error(errorMessage(error, text("Не удалось загрузить кандидатов", "Failed to load candidates")));
    } finally {
      setIsLoading(false);
    }
  }, [canViewVacancies, text]);

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

  function openCreate(): void {
    if (!canCreate) return;
    if (openVacancies.length === 0) {
      toast.info(text("Нет открытых вакансий, в которые можно добавить кандидата", "There are no open vacancies to add a candidate to"));
      return;
    }
    setDraft(emptyCandidate());
  }

  async function selectVacancy(vacancyId: string): Promise<void> {
    setDraft((current) =>
      current ? { ...current, vacancyId, skills: [] } : current,
    );
    if (!vacancyId) return;

    try {
      const profile = await hrApiClient.getVacancy(Number(vacancyId));
      if (!profile) throw new Error(text("Вакансия не найдена", "Vacancy not found"));
      if (
        profile.vacancy.status !== "open" ||
        Number(profile.vacancy.is_archived ?? 0) === 1
      ) {
        throw new Error(text("Добавлять кандидатов можно только в открытую вакансию", "Candidates can only be added to an open vacancy"));
      }
      setDraft((current) =>
        current
          ? {
              ...current,
              vacancyId,
              skills: profile.skills.map((skill) => ({
                vacancySkillId: Number(skill.id),
                name: String(skill.name ?? ""),
                requiredLevel: Number(skill.required_level ?? 5),
                score: 0,
              })),
            }
          : current,
      );
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось загрузить вакансию", "Failed to load vacancy")));
    }
  }

  async function saveCandidate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!draft || !canCreate) return;
    if (!draft.vacancyId) {
      toast.error(text("Выберите вакансию", "Select a vacancy"));
      return;
    }

    setIsSaving(true);
    try {
      const saved = await hrApiClient.saveCandidate({
        vacancyId: Number(draft.vacancyId),
        lastName: draft.lastName,
        firstName: draft.firstName,
        middleName: draft.middleName || undefined,
        birthDate: draft.birthDate || undefined,
        phone: draft.phone || undefined,
        email: draft.email || undefined,
        source: draft.source || undefined,
        skillScores: draft.skills.map((skill) => ({
          vacancySkillId: skill.vacancySkillId,
          score: skill.score,
        })),
      });
      setDraft(null);
      toast.success(text("Кандидат зарегистрирован на этапе «Новый»", "Candidate registered at the New stage"));
      navigate("/candidates/" + String(saved.candidate.id));
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось добавить кандидата", "Failed to add candidate")));
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
      toast.success(text("Ошибочная запись кандидата удалена", "Incorrect candidate record deleted"));
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось удалить кандидата", "Failed to delete candidate")));
    } finally {
      setIsSaving(false);
    }
  }

  const columns: DataTableColumn<HrRecord>[] = [
    {
      key: "name",
      header: text("ФИО", "Full name"),
      render: (candidate) => (
        <span className="app-text font-black">{candidateFullName(candidate, text("Без имени", "Unnamed"))}</span>
      ),
    },
    {
      key: "vacancy",
      header: text("Вакансия / структура", "Vacancy / structure"),
      render: (candidate) => (
        <div className="min-w-[210px]">
          <p className="app-text font-bold">
            {String(candidate.position_name ?? "—")}
          </p>
          <p className="app-muted mt-1 text-xs font-semibold">
            {[candidate.enterprise_name, candidate.department_name]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "contacts",
      header: text("Контакты", "Contacts"),
      render: (candidate) => (
        <div className="min-w-[170px] space-y-1">
          <p className="app-text-soft text-sm">
            {String(candidate.phone ?? "—")}
          </p>
          <p className="app-muted truncate text-xs">
            {String(candidate.email ?? "—")}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: text("Этап", "Stage"),
      render: (candidate) => (
        <RecruitmentBadge tone={candidateStatusTone(candidate.status)}>
          {candidateStatusLabel(candidate.status)}
        </RecruitmentBadge>
      ),
    },
    {
      key: "match",
      header: text("Соответствие", "Match"),
      render: (candidate) => (
        <div className="min-w-[160px]">
          <MatchBar value={Number(candidate.match_percentage ?? 0)} />
        </div>
      ),
    },
    {
      key: "source",
      header: text("Источник", "Source"),
      render: (candidate) => (
        <span className="app-text-soft">{String(candidate.source ?? "—")}</span>
      ),
    },
    {
      key: "actions",
      header: text("Действия", "Actions"),
      align: "center",
      render: (candidate) => {
        const canDeleteCandidate =
          canDelete &&
          candidate.status === "new" &&
          !candidate.employee_id;
        return (
          <div className="flex items-center justify-center gap-2">
            <ActionButton
              action="open"
              onClick={() =>
                navigate("/candidates/" + String(candidate.id))
              }
              size="sm"
              type="button"
            >
              {text("Карточка", "Profile")}
            </ActionButton>
            {canDeleteCandidate && (
              <ActionButton
                action="delete"
                onClick={() => setDeleteTarget(candidate)}
                size="sm"
                type="button"
              >
                {text("Удалить", "Delete")}
              </ActionButton>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <RecruitmentPageHeader
        actionLabel={canCreate ? text("Добавить кандидата", "Add candidate") : undefined}
        description={text("Кандидаты проходят последовательные этапы подбора до найма или отказа.", "Candidates move through sequential recruitment stages until they are hired or rejected.")}
        icon={<FiUserPlus className="h-6 w-6" />}
        onAction={canCreate ? openCreate : undefined}
        title={text("Кандидаты", "Candidates")}
      />

      <DataTable
        ariaLabel={text("Реестр кандидатов", "Candidate registry")}
        columns={columns}
        emptyDescription={
          candidates.length > 0
            ? text("Измените или очистите фильтры на странице фильтров.", "Change or clear filters on the filters page.")
            : canCreate
              ? text("Добавьте кандидата в открытую вакансию.", "Add a candidate to an open vacancy.")
              : "В доступной области пока нет кандидатов."
        }
        emptyTitle={
          candidates.length > 0
            ? text("Нет кандидатов по выбранным фильтрам", "No candidates match the selected filters")
            : text("Кандидатов пока нет", "No candidates yet")
        }
        footer={
          <>
            {text("Кандидатов:", "Candidates:")}{" "}
            <span className="app-text font-black">
              {filteredCandidates.length}
            </span>
          </>
        }
        getRowKey={(candidate) => String(candidate.id)}
        isLoading={isLoading}
        loadingLabel={text("Загрузка кандидатов...", "Loading candidates...")}
        onRowClick={(candidate) =>
          navigate("/candidates/" + String(candidate.id))
        }
        rows={filteredCandidates}
        toolbar={
          <div className="ml-auto">
            <ActionButton
              action="refresh"
              loading={isLoading}
              onClick={() => void loadData()}
              type="button"
            />
          </div>
        }
      />

      {draft && canCreate && (
        <Dialog
          description={text("После сохранения кандидат появится на этапе «Новый». Этапы меняются только из карточки кандидата.", "After saving, the candidate will appear at the New stage. Stages can only be changed from the candidate profile.")}
          footer={
            <FormActions
              loading={isSaving}
              onCancel={() => setDraft(null)}
              onSubmit={() => {
                const form = document.getElementById(
                  "candidate-create-form",
                ) as HTMLFormElement | null;
                form?.requestSubmit();
              }}
              submitAction="create"
              submitDisabled={
                !draft.vacancyId ||
                !draft.lastName.trim() ||
                !draft.firstName.trim()
              }
              submitLabel={text("Создать кандидата", "Create candidate")}
              submitType="button"
            />
          }
          onOpenChange={(open) => !open && setDraft(null)}
          open
          size="lg"
          title={text("Новый кандидат", "New candidate")}
        >
          <form
            className="grid gap-5"
            id="candidate-create-form"
            onSubmit={saveCandidate}
          >
            <FormField label={text("Вакансия", "Vacancy")}>
              <Select
                onValueChange={(value) => void selectVacancy(value)}
                options={vacancyOptions}
                placeholder={text("Выберите открытую вакансию", "Select an open vacancy")}
                value={draft.vacancyId}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                autoFocus
                label={text("Фамилия", "Last name")}
                onChange={(lastName) =>
                  setDraft((current) =>
                    current ? { ...current, lastName } : current,
                  )
                }
                required
                value={draft.lastName}
              />
              <TextField
                label={text("Имя", "First name")}
                onChange={(firstName) =>
                  setDraft((current) =>
                    current ? { ...current, firstName } : current,
                  )
                }
                required
                value={draft.firstName}
              />
              <TextField
                label={text("Отчество", "Middle name")}
                onChange={(middleName) =>
                  setDraft((current) =>
                    current ? { ...current, middleName } : current,
                  )
                }
                value={draft.middleName}
              />
              <TextField
                label={text("Дата рождения", "Date of birth")}
                onChange={(birthDate) =>
                  setDraft((current) =>
                    current ? { ...current, birthDate } : current,
                  )
                }
                type="date"
                value={draft.birthDate}
              />
              <TextField
                label={text("Телефон", "Phone")}
                onChange={(phone) =>
                  setDraft((current) =>
                    current ? { ...current, phone } : current,
                  )
                }
                type="tel"
                value={draft.phone}
              />
              <TextField
                label="Email"
                onChange={(email) =>
                  setDraft((current) =>
                    current ? { ...current, email } : current,
                  )
                }
                type="email"
                value={draft.email}
              />
              <TextField
                label={text("Источник", "Source")}
                onChange={(source) =>
                  setDraft((current) =>
                    current ? { ...current, source } : current,
                  )
                }
                placeholder={text("Рекомендация, сайт, соцсеть", "Referral, website, social network")}
                value={draft.source}
              />
            </div>

            {draft.vacancyId && (
              <section className="app-surface-muted app-border rounded-2xl border p-4">
                <h3 className="app-text font-black">{text("Оценка навыков", "Skill assessment")}</h3>
                <p className="app-muted mt-1 text-xs font-semibold">
                  {text("0 — навыка нет, 10 — экспертный уровень.", "0 — no skill, 10 — expert level.")}
                </p>
                <div className="mt-4 space-y-3">
                  {draft.skills.map((skill) => (
                    <div
                      className="app-surface app-border grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_110px] sm:items-center"
                      key={skill.vacancySkillId}
                    >
                      <div>
                        <p className="app-text font-bold">{skill.name}</p>
                        <p className="app-muted mt-1 text-xs">
                          {text("Требуется:", "Required:")} {skill.requiredLevel}/10
                        </p>
                      </div>
                      <Input
                        aria-label={text("Оценка навыка " + skill.name, "Skill score " + skill.name)}
                        max="10"
                        min="0"
                        onChange={(event) => {
                          const score = Number(event.target.value);
                          setDraft((current) =>
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
            )}
          </form>
        </Dialog>
      )}

      {canDelete && (
        <DeleteConfirmDialog
          confirmLabel={text("Удалить ошибочную запись", "Delete incorrect record")}
          description={text("Удалить можно только нового кандидата, который ещё не переходил по этапам. История подбора после первого перехода сохраняется.", "Only a new candidate who has not advanced through stages can be deleted. Recruitment history is preserved after the first transition.")}
          isLoading={isSaving}
          onConfirm={deleteCandidate}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          open={Boolean(deleteTarget)}
          title={text("Удалить кандидата?", "Delete candidate?")}
        />
      )}
    </div>
  );
}

function TextField({
  autoFocus,
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  autoFocus?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}): JSX.Element {
  return (
    <FormField label={label}>
      <Input
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </FormField>
  );
}

function candidateFullName(candidate: HrRecord, fallback: string): string {
  return [candidate.last_name, candidate.first_name, candidate.middle_name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ") || fallback;
}

function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
