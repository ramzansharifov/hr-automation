import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiBriefcase,
  FiMessageCircle,
  FiPlus,
  FiSave,
  FiTool,
  FiX,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { FormField } from "../../features/recruitment/RecruitmentUi";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  SaveVacancyParams,
  VacancySkillInput,
  VacancySkillType,
} from "../../shared/types/hr";
import {
  Button,
  Input,
  LoadingState,
  Select,
  Textarea,
  type SelectOption,
} from "../../shared/ui";

interface VacancySkillState extends VacancySkillInput {
  key: string;
}

interface VacancyFormState {
  positionId: string;
  status: SaveVacancyParams["status"];
  employmentType: SaveVacancyParams["employmentType"];
  openingsCount: string;
  note: string;
  hardSkills: VacancySkillState[];
  softSkills: VacancySkillState[];
}

const emptyForm = (): VacancyFormState => ({
  positionId: "",
  status: "open",
  employmentType: "full_time",
  openingsCount: "1",
  note: "",
  hardSkills: [newSkill("hard")],
  softSkills: [newSkill("soft")],
});

export function VacancyFormPage(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams();
  const vacancyId = id ? Number(id) : undefined;
  const isEdit = Number.isInteger(vacancyId) && Number(vacancyId) > 0;

  const [form, setForm] = useState<VacancyFormState>(emptyForm);
  const [positions, setPositions] = useState<SelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const pageTitle = isEdit ? "Редактировать вакансию" : "Новая вакансия";

  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [positionRows, profile] = await Promise.all([
        hrApiClient.list({
          entity: "positions",
          page: 1,
          pageSize: 100,
          orderBy: "name",
        }),
        isEdit
          ? hrApiClient.getVacancy(Number(vacancyId))
          : Promise.resolve(null),
      ]);

      setPositions(
        positionRows.items.map((position) => ({
          value: String(position.id),
          label: [
            position.name,
            position.department_name,
            position.enterprise_name,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
      );

      if (isEdit) {
        if (!profile) throw new Error("Вакансия не найдена");
        const vacancy = profile.vacancy;
        const skills = profile.skills.map((skill) => ({
          id: Number(skill.id),
          key: `skill-${String(skill.id)}`,
          type: normalizeSkillType(skill.skill_type),
          name: String(skill.name ?? ""),
          requiredLevel: Number(skill.required_level ?? 5),
          weight: Number(skill.weight ?? 3),
          note: String(skill.note ?? ""),
        }));

        setForm({
          positionId: String(vacancy.position_id ?? ""),
          status: String(vacancy.status) as VacancyFormState["status"],
          employmentType: String(
            vacancy.employment_type,
          ) as VacancyFormState["employmentType"],
          openingsCount: String(vacancy.openings_count ?? 1),
          note: String(vacancy.note ?? ""),
          hardSkills: skills.filter((skill) => skill.type === "hard"),
          softSkills: skills.filter((skill) => skill.type === "soft"),
        });
      } else {
        setForm(emptyForm());
      }
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось открыть форму вакансии"));
      navigate("/vacancies", { replace: true });
    } finally {
      setIsLoading(false);
    }
  }, [isEdit, navigate, vacancyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedPositionLabel = useMemo(
    () => positions.find((position) => position.value === form.positionId)?.label,
    [form.positionId, positions],
  );

  async function saveVacancy(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    try {
      await hrApiClient.saveVacancy({
        id: isEdit ? Number(vacancyId) : undefined,
        positionId: Number(form.positionId),
        status: form.status,
        employmentType: form.employmentType,
        openingsCount: Number(form.openingsCount),
        note: form.note,
        skills: [...form.hardSkills, ...form.softSkills].map((skill) => ({
          id: skill.id,
          type: skill.type,
          name: skill.name,
          requiredLevel: skill.requiredLevel,
          weight: skill.weight,
          note: skill.note,
        })),
      });
      toast.success(isEdit ? "Вакансия обновлена" : "Вакансия создана");
      navigate("/vacancies");
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось сохранить вакансию"));
    } finally {
      setIsSaving(false);
    }
  }

  function addSkill(type: VacancySkillType): void {
    const field = type === "hard" ? "hardSkills" : "softSkills";
    setForm((current) => ({
      ...current,
      [field]: [...current[field], newSkill(type)],
    }));
  }

  function updateSkill(
    type: VacancySkillType,
    key: string,
    patch: Partial<VacancySkillState>,
  ): void {
    const field = type === "hard" ? "hardSkills" : "softSkills";
    setForm((current) => ({
      ...current,
      [field]: current[field].map((skill) =>
        skill.key === key ? { ...skill, ...patch } : skill,
      ),
    }));
  }

  function removeSkill(type: VacancySkillType, key: string): void {
    const field = type === "hard" ? "hardSkills" : "softSkills";
    setForm((current) => ({
      ...current,
      [field]: current[field].filter((skill) => skill.key !== key),
    }));
  }

  if (isLoading) {
    return <LoadingState label="Загрузка формы вакансии..." />;
  }

  return (
    <div className="space-y-6">
      <section className="app-surface app-border flex flex-col gap-5 rounded-[28px] border p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Button
            aria-label="Вернуться к вакансиям"
            className="h-12 w-12 shrink-0 p-0"
            onClick={() => navigate("/vacancies")}
            type="button"
            variant="ghost"
          >
            <FiArrowLeft className="h-5 w-5" />
          </Button>
          <span className="app-accent-soft flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent-border)]">
            <FiBriefcase className="h-6 w-6" />
          </span>
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.18em]">
              Подбор персонала
            </p>
            <h1 className="app-text mt-1 text-3xl font-black tracking-tight">
              {pageTitle}
            </h1>
            <p className="app-muted mt-2 max-w-3xl text-sm font-medium leading-6">
              Должность используется как название вакансии. Требования задаются только через hard и soft skills.
            </p>
          </div>
        </div>
        {selectedPositionLabel && (
          <div className="app-surface-muted app-border max-w-md rounded-2xl border px-4 py-3">
            <p className="app-muted text-xs font-black uppercase tracking-[0.12em]">
              Выбранная должность
            </p>
            <p className="app-text mt-1 text-sm font-bold">
              {selectedPositionLabel}
            </p>
          </div>
        )}
      </section>

      <form
        className="app-surface app-border mx-auto max-w-6xl overflow-hidden rounded-[28px] border"
        onSubmit={saveVacancy}
      >
        <div className="space-y-6 p-5 sm:p-8">
          <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="app-text text-xl font-black">Основная информация</h2>
              <p className="app-muted mt-1 text-sm">
                Название отдельно не указывается — им является выбранная должность.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Должность">
                <Select
                  onValueChange={(positionId) =>
                    setForm((current) => ({ ...current, positionId }))
                  }
                  options={positions}
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
              <FormField label="Количество открытых мест">
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
          </section>

          <SkillSection
            description="Профессиональные знания, инструменты и технические компетенции."
            icon={<FiTool className="h-5 w-5" />}
            onAdd={() => addSkill("hard")}
            onRemove={(key) => removeSkill("hard", key)}
            onUpdate={(key, patch) => updateSkill("hard", key, patch)}
            skills={form.hardSkills}
            title="Hard skills"
          />

          <SkillSection
            description="Коммуникация, командная работа и другие поведенческие компетенции."
            icon={<FiMessageCircle className="h-5 w-5" />}
            onAdd={() => addSkill("soft")}
            onRemove={(key) => removeSkill("soft", key)}
            onUpdate={(key, patch) => updateSkill("soft", key, patch)}
            skills={form.softSkills}
            title="Soft skills"
          />

          <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
            <FormField label="Внутренняя заметка">
              <Textarea
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                placeholder="Служебная информация, видимая только внутри системы"
                rows={4}
                value={form.note}
              />
            </FormField>
          </section>
        </div>

        <footer className="app-surface-muted app-border-soft flex flex-col gap-3 border-t p-5 sm:flex-row sm:justify-end sm:p-6">
          <Button
            onClick={() => navigate("/vacancies")}
            type="button"
            variant="secondary"
          >
            Отмена
          </Button>
          <Button
            disabled={isSaving}
            leftIcon={<FiSave className="h-4 w-4" />}
            type="submit"
          >
            {isEdit ? "Сохранить изменения" : "Создать вакансию"}
          </Button>
        </footer>
      </form>
    </div>
  );
}

function SkillSection({
  description,
  icon,
  onAdd,
  onRemove,
  onUpdate,
  skills,
  title,
}: {
  description: string;
  icon: JSX.Element;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onUpdate: (key: string, patch: Partial<VacancySkillState>) => void;
  skills: VacancySkillState[];
  title: string;
}): JSX.Element {
  return (
    <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-border)]">
            {icon}
          </span>
          <div>
            <h2 className="app-text text-xl font-black">{title}</h2>
            <p className="app-muted mt-1 text-sm">{description}</p>
            <p className="app-muted mt-1 text-xs font-semibold">
              Уровень: 1–10 · вес важности: 1–5
            </p>
          </div>
        </div>
        <Button
          leftIcon={<FiPlus className="h-4 w-4" />}
          onClick={onAdd}
          type="button"
          variant="secondary"
        >
          Добавить навык
        </Button>
      </div>

      {skills.length === 0 ? (
        <div className="app-surface app-border app-muted mt-5 rounded-2xl border border-dashed p-6 text-center text-sm font-semibold">
          Навыки этой категории пока не добавлены.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {skills.map((skill, index) => (
            <div
              className="app-surface app-border grid gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_120px_110px_44px]"
              key={skill.key}
            >
              <Input
                aria-label={`${title}, навык ${index + 1}`}
                onChange={(event) =>
                  onUpdate(skill.key, { name: event.target.value })
                }
                placeholder={
                  skill.type === "hard"
                    ? "Например: SQL"
                    : "Например: Командная работа"
                }
                required
                value={skill.name}
              />
              <Input
                aria-label="Требуемый уровень"
                max="10"
                min="1"
                onChange={(event) =>
                  onUpdate(skill.key, {
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
                  onUpdate(skill.key, { weight: Number(event.target.value) })
                }
                required
                type="number"
                value={skill.weight}
              />
              <Button
                aria-label="Удалить навык"
                className="h-10 w-10 p-0"
                onClick={() => onRemove(skill.key)}
                type="button"
                variant="ghost"
              >
                <FiX className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function newSkill(type: VacancySkillType): VacancySkillState {
  return {
    key: `new-${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    name: "",
    requiredLevel: 5,
    weight: 3,
    note: "",
  };
}

function normalizeSkillType(value: unknown): VacancySkillType {
  return value === "soft" ? "soft" : "hard";
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
function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
