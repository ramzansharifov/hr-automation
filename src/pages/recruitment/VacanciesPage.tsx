import { useCallback, useEffect, useState } from "react";
import {
  FiBriefcase,
  FiEdit2,
  FiMapPin,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { toast } from "react-toastify";

import {
  FormField,
  RecruitmentBadge,
  RecruitmentPageHeader,
  RecruitmentSearch,
} from "../../features/recruitment/RecruitmentUi";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  HrRecord,
  SaveVacancyParams,
  VacancySkillInput,
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

interface VacancyFormState {
  id?: number;
  positionId: string;
  title: string;
  status: SaveVacancyParams["status"];
  employmentType: SaveVacancyParams["employmentType"];
  openingsCount: string;
  description: string;
  requirements: string;
  note: string;
  skills: Array<VacancySkillInput & { key: string }>;
}

const emptyForm = (): VacancyFormState => ({
  positionId: "",
  title: "",
  status: "open",
  employmentType: "full_time",
  openingsCount: "1",
  description: "",
  requirements: "",
  note: "",
  skills: [newSkill()],
});

export function VacanciesPage(): JSX.Element {
  const [vacancies, setVacancies] = useState<HrRecord[]>([]);
  const [positionOptions, setPositionOptions] = useState<SelectOption[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<VacancyFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [vacancyRows, positions] = await Promise.all([
        hrApiClient.listVacancies({ search }),
        hrApiClient.list({
          entity: "positions",
          page: 1,
          pageSize: 100,
          orderBy: "name",
        }),
      ]);
      setVacancies(vacancyRows);
      setPositionOptions(
        positions.items.map((position) => ({
          value: String(position.id),
          label: [position.name, position.department_name]
            .filter(Boolean)
            .join(" · "),
        })),
      );
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить вакансии"));
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadData(), 180);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  function openCreate(): void {
    setForm(emptyForm());
    setIsDialogOpen(true);
  }

  async function openEdit(record: HrRecord): Promise<void> {
    try {
      const profile = await hrApiClient.getVacancy(Number(record.id));
      if (!profile) throw new Error("Вакансия не найдена");
      const vacancy = profile.vacancy;
      setForm({
        id: Number(vacancy.id),
        positionId: String(vacancy.position_id ?? ""),
        title: String(vacancy.title ?? ""),
        status: String(vacancy.status) as VacancyFormState["status"],
        employmentType: String(
          vacancy.employment_type,
        ) as VacancyFormState["employmentType"],
        openingsCount: String(vacancy.openings_count ?? 1),
        description: String(vacancy.description ?? ""),
        requirements: String(vacancy.requirements ?? ""),
        note: String(vacancy.note ?? ""),
        skills: profile.skills.map((skill) => ({
          id: Number(skill.id),
          key: `skill-${String(skill.id)}`,
          name: String(skill.name ?? ""),
          requiredLevel: Number(skill.required_level ?? 5),
          weight: Number(skill.weight ?? 3),
          note: String(skill.note ?? ""),
        })),
      });
      setIsDialogOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось открыть вакансию"));
    }
  }

  async function saveVacancy(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    try {
      await hrApiClient.saveVacancy({
        id: form.id,
        positionId: Number(form.positionId),
        title: form.title,
        status: form.status,
        employmentType: form.employmentType,
        openingsCount: Number(form.openingsCount),
        description: form.description,
        requirements: form.requirements,
        note: form.note,
        skills: form.skills.map((skill) => ({
          id: skill.id,
          name: skill.name,
          requiredLevel: skill.requiredLevel,
          weight: skill.weight,
          note: skill.note,
        })),
      });
      setIsDialogOpen(false);
      await loadData();
      toast.success(form.id ? "Вакансия обновлена" : "Вакансия создана");
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось сохранить вакансию"));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteVacancy(): Promise<void> {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await hrApiClient.deleteVacancy(Number(deleteTarget.id));
      setDeleteTarget(null);
      await loadData();
      toast.success("Вакансия удалена");
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось удалить вакансию"));
    } finally {
      setIsSaving(false);
    }
  }

  function updateSkill(
    key: string,
    patch: Partial<VacancyFormState["skills"][number]>,
  ): void {
    setForm((current) => ({
      ...current,
      skills: current.skills.map((skill) =>
        skill.key === key ? { ...skill, ...patch } : skill,
      ),
    }));
  }

  return (
    <div className="space-y-6">
      <RecruitmentPageHeader
        actionLabel="Создать вакансию"
        description="Открытые позиции, требования, заметки и измеримый набор навыков для оценки кандидатов."
        icon={<FiBriefcase className="h-6 w-6" />}
        onAction={openCreate}
        title="Вакансии"
      />
      <RecruitmentSearch
        onChange={setSearch}
        placeholder="Поиск по вакансии, должности, отделу или навыку"
        value={search}
      />

      {isLoading ? (
        <LoadingState label="Загрузка вакансий..." />
      ) : vacancies.length === 0 ? (
        <div className="app-surface app-border rounded-[28px] border py-12">
          <EmptyState
            title="Вакансий пока нет"
            description="Создайте первую вакансию и добавьте навыки для оценки кандидатов."
          />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {vacancies.map((vacancy) => (
            <VacancyCard
              key={String(vacancy.id)}
              onDelete={() => setDeleteTarget(vacancy)}
              onEdit={() => void openEdit(vacancy)}
              vacancy={vacancy}
            />
          ))}
        </div>
      )}

      <Dialog
        description="Привяжите вакансию к должности и задайте навыки, по которым будут оцениваться кандидаты."
        onOpenChange={setIsDialogOpen}
        open={isDialogOpen}
        title={form.id ? "Редактировать вакансию" : "Новая вакансия"}
      >
        <form className="grid gap-5" onSubmit={saveVacancy}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Название вакансии">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                required
                value={form.title}
              />
            </FormField>
            <FormField label="Должность">
              <Select
                onValueChange={(positionId) =>
                  setForm((current) => ({ ...current, positionId }))
                }
                options={positionOptions}
                placeholder="Выберите должность"
                value={form.positionId}
              />
            </FormField>
            <FormField label="Статус">
              <Select
                onValueChange={(status) =>
                  setForm((current) => ({
                    ...current,
                    status: status as VacancyFormState["status"],
                  }))
                }
                options={vacancyStatusOptions}
                value={form.status}
              />
            </FormField>
            <FormField label="Формат занятости">
              <Select
                onValueChange={(employmentType) =>
                  setForm((current) => ({
                    ...current,
                    employmentType:
                      employmentType as VacancyFormState["employmentType"],
                  }))
                }
                options={employmentTypeOptions}
                value={form.employmentType}
              />
            </FormField>
            <FormField label="Количество мест">
              <Input
                min="1"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    openingsCount: event.target.value,
                  }))
                }
                required
                type="number"
                value={form.openingsCount}
              />
            </FormField>
          </div>
          <FormField label="Описание">
            <Textarea
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={3}
              value={form.description}
            />
          </FormField>
          <FormField label="Что требуется">
            <Textarea
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  requirements: event.target.value,
                }))
              }
              rows={4}
              value={form.requirements}
            />
          </FormField>
          <FormField label="Внутренняя заметка">
            <Textarea
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              rows={2}
              value={form.note}
            />
          </FormField>

          <section className="app-surface-muted app-border rounded-[24px] border p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="app-text text-lg font-black">Навыки вакансии</h3>
                <p className="app-muted mt-1 text-xs font-semibold">
                  Уровень — требование от 1 до 10, вес — важность от 1 до 5.
                </p>
              </div>
              <Button
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    skills: [...current.skills, newSkill()],
                  }))
                }
                type="button"
                variant="secondary"
              >
                Добавить навык
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {form.skills.map((skill, index) => (
                <div
                  className="app-surface app-border grid gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_110px_100px_40px]"
                  key={skill.key}
                >
                  <Input
                    aria-label={`Навык ${index + 1}`}
                    onChange={(event) =>
                      updateSkill(skill.key, { name: event.target.value })
                    }
                    placeholder="Например: SQL"
                    required
                    value={skill.name}
                  />
                  <Input
                    aria-label="Требуемый уровень"
                    max="10"
                    min="1"
                    onChange={(event) =>
                      updateSkill(skill.key, {
                        requiredLevel: Number(event.target.value),
                      })
                    }
                    required
                    type="number"
                    value={skill.requiredLevel}
                  />
                  <Input
                    aria-label="Вес навыка"
                    max="5"
                    min="1"
                    onChange={(event) =>
                      updateSkill(skill.key, {
                        weight: Number(event.target.value),
                      })
                    }
                    required
                    type="number"
                    value={skill.weight}
                  />
                  <Button
                    aria-label="Удалить навык"
                    className="h-10 w-10 p-0"
                    disabled={form.skills.length === 1}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        skills: current.skills.filter(
                          (item) => item.key !== skill.key,
                        ),
                      }))
                    }
                    type="button"
                    variant="ghost"
                  >
                    <FiX className="h-4 w-4" />
                  </Button>
                </div>
              ))}
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
            <Button disabled={isSaving} type="submit">
              Сохранить вакансию
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        cancelLabel="Отмена"
        confirmLabel="Удалить"
        description="Вакансия и её навыки будут удалены. Вакансию с кандидатами удалить нельзя."
        isLoading={isSaving}
        onConfirm={() => void deleteVacancy()}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={Boolean(deleteTarget)}
        title="Удалить вакансию?"
      />
    </div>
  );
}

function VacancyCard({
  onDelete,
  onEdit,
  vacancy,
}: {
  onDelete: () => void;
  onEdit: () => void;
  vacancy: HrRecord;
}): JSX.Element {
  const skills = String(vacancy.skills_summary ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return (
    <article className="app-surface app-border group relative overflow-hidden rounded-[28px] border p-6 transition-colors hover:border-[var(--accent-border)]">
      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <RecruitmentBadge tone={vacancy.status === "open" ? "success" : "neutral"}>
              {vacancyStatusLabel(String(vacancy.status))}
            </RecruitmentBadge>
            <RecruitmentBadge>
              {employmentTypeLabel(String(vacancy.employment_type))}
            </RecruitmentBadge>
          </div>
          <h2 className="app-text mt-4 text-2xl font-black tracking-tight">
            {String(vacancy.title)}
          </h2>
          <p className="app-muted mt-2 flex items-center gap-2 text-sm font-bold">
            <FiBriefcase className="h-4 w-4" />
            {String(vacancy.position_name ?? "—")}
          </p>
          <p className="app-muted mt-1 flex items-center gap-2 text-sm">
            <FiMapPin className="h-4 w-4" />
            {[vacancy.enterprise_name, vacancy.department_name]
              .filter(Boolean)
              .join(" · ") || "Структура не указана"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="h-10 w-10 p-0" onClick={onEdit} variant="ghost">
            <FiEdit2 className="h-4 w-4" />
          </Button>
          <Button className="h-10 w-10 p-0" onClick={onDelete} variant="ghost">
            <FiTrash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {Boolean(vacancy.requirements) && (
        <p className="app-text-soft mt-5 line-clamp-3 text-sm leading-6">
          {String(vacancy.requirements)}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {skills.slice(0, 6).map((skill) => (
          <RecruitmentBadge key={skill} tone="accent">
            {skill}
          </RecruitmentBadge>
        ))}
        {skills.length > 6 && (
          <RecruitmentBadge>+{skills.length - 6}</RecruitmentBadge>
        )}
      </div>
      <div className="app-border-soft app-muted mt-5 flex flex-wrap gap-5 border-t pt-4 text-sm font-bold">
        <span className="flex items-center gap-2">
          <FiUsers className="h-4 w-4" />
          Кандидатов: {String(vacancy.candidates_count ?? 0)}
        </span>
        <span>Мест: {String(vacancy.openings_count ?? 1)}</span>
        <span>Навыков: {String(vacancy.skills_count ?? 0)}</span>
      </div>
    </article>
  );
}

function newSkill(): VacancyFormState["skills"][number] {
  return {
    key: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: "",
    requiredLevel: 5,
    weight: 3,
    note: "",
  };
}

const vacancyStatusOptions: SelectOption[] = [
  { value: "open", label: "Открыта" },
  { value: "draft", label: "Черновик" },
  { value: "paused", label: "Приостановлена" },
  { value: "closed", label: "Закрыта" },
];
const employmentTypeOptions: SelectOption[] = [
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
