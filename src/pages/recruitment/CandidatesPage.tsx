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
            .join(" · ") || "Вакансия #" + String(vacancy.id),
      })),
    [openVacancies],
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

  function openCreate(): void {
    if (!canCreate) return;
    if (openVacancies.length === 0) {
      toast.info("Нет открытых вакансий, в которые можно добавить кандидата");
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
      if (!profile) throw new Error("Вакансия не найдена");
      if (
        profile.vacancy.status !== "open" ||
        Number(profile.vacancy.is_archived ?? 0) === 1
      ) {
        throw new Error("Добавлять кандидатов можно только в открытую вакансию");
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
      toast.error(errorMessage(error, "Не удалось загрузить вакансию"));
    }
  }

  async function saveCandidate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!draft || !canCreate) return;
    if (!draft.vacancyId) {
      toast.error("Выберите вакансию");
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
      toast.success("Кандидат зарегистрирован на этапе «Новый»");
      navigate("/candidates/" + String(saved.candidate.id));
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось добавить кандидата"));
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
      header: "Контакты",
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
      header: "Этап",
      render: (candidate) => (
        <RecruitmentBadge tone={candidateStatusTone(candidate.status)}>
          {candidateStatusLabel(candidate.status)}
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
    {
      key: "actions",
      header: "Действия",
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
              Карточка
            </ActionButton>
            {canDeleteCandidate && (
              <ActionButton
                action="delete"
                onClick={() => setDeleteTarget(candidate)}
                size="sm"
                type="button"
              >
                Удалить
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
        actionLabel={canCreate ? "Добавить кандидата" : undefined}
        description="Кандидаты проходят последовательные этапы подбора до найма или отказа."
        icon={<FiUserPlus className="h-6 w-6" />}
        onAction={canCreate ? openCreate : undefined}
        title="Кандидаты"
      />

      <DataTable
        ariaLabel="Реестр кандидатов"
        columns={columns}
        emptyDescription={
          candidates.length > 0
            ? "Измените или очистите фильтры на странице фильтров."
            : canCreate
              ? "Добавьте кандидата в открытую вакансию."
              : "В доступной области пока нет кандидатов."
        }
        emptyTitle={
          candidates.length > 0
            ? "Нет кандидатов по выбранным фильтрам"
            : "Кандидатов пока нет"
        }
        footer={
          <>
            Кандидатов:{" "}
            <span className="app-text font-black">
              {filteredCandidates.length}
            </span>
          </>
        }
        getRowKey={(candidate) => String(candidate.id)}
        isLoading={isLoading}
        loadingLabel="Загрузка кандидатов..."
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
          description="После сохранения кандидат появится на этапе «Новый». Этапы меняются только из карточки кандидата."
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
              submitLabel="Создать кандидата"
              submitType="button"
            />
          }
          onOpenChange={(open) => !open && setDraft(null)}
          open
          size="lg"
          title="Новый кандидат"
        >
          <form
            className="grid gap-5"
            id="candidate-create-form"
            onSubmit={saveCandidate}
          >
            <FormField label="Вакансия">
              <Select
                onValueChange={(value) => void selectVacancy(value)}
                options={vacancyOptions}
                placeholder="Выберите открытую вакансию"
                value={draft.vacancyId}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                autoFocus
                label="Фамилия"
                onChange={(lastName) =>
                  setDraft((current) =>
                    current ? { ...current, lastName } : current,
                  )
                }
                required
                value={draft.lastName}
              />
              <TextField
                label="Имя"
                onChange={(firstName) =>
                  setDraft((current) =>
                    current ? { ...current, firstName } : current,
                  )
                }
                required
                value={draft.firstName}
              />
              <TextField
                label="Отчество"
                onChange={(middleName) =>
                  setDraft((current) =>
                    current ? { ...current, middleName } : current,
                  )
                }
                value={draft.middleName}
              />
              <TextField
                label="Дата рождения"
                onChange={(birthDate) =>
                  setDraft((current) =>
                    current ? { ...current, birthDate } : current,
                  )
                }
                type="date"
                value={draft.birthDate}
              />
              <TextField
                label="Телефон"
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
                label="Источник"
                onChange={(source) =>
                  setDraft((current) =>
                    current ? { ...current, source } : current,
                  )
                }
                placeholder="Рекомендация, сайт, соцсеть"
                value={draft.source}
              />
            </div>

            {draft.vacancyId && (
              <section className="app-surface-muted app-border rounded-2xl border p-4">
                <h3 className="app-text font-black">Оценка навыков</h3>
                <p className="app-muted mt-1 text-xs font-semibold">
                  0 — навыка нет, 10 — экспертный уровень.
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
                          Требуется: {skill.requiredLevel}/10
                        </p>
                      </div>
                      <Input
                        aria-label={"Оценка навыка " + skill.name}
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
          confirmLabel="Удалить ошибочную запись"
          description="Удалить можно только нового кандидата, который ещё не переходил по этапам. История подбора после первого перехода сохраняется."
          isLoading={isSaving}
          onConfirm={deleteCandidate}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          open={Boolean(deleteTarget)}
          title="Удалить кандидата?"
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

function candidateFullName(candidate: HrRecord): string {
  return [candidate.last_name, candidate.first_name, candidate.middle_name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ") || "Без имени";
}

function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
