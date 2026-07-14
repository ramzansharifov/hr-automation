import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiBriefcase,
  FiCheck,
  FiCheckCircle,
  FiChevronRight,
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

  const pageTitle = isEdit ? "Редактирование вакансии" : "Новая вакансия";

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
  const allSkills = [...form.hardSkills, ...form.softSkills];
  const namedSkillsCount = allSkills.filter((skill) => skill.name.trim()).length;
  const canSave =
    Boolean(form.positionId) &&
    allSkills.length > 0 &&
    namedSkillsCount === allSkills.length &&
    !isSaving;

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
        skills: allSkills.map((skill) => ({
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
    <div className="mx-auto max-w-[1440px] space-y-6">
      <section
        className="app-border relative overflow-hidden rounded-[32px] border p-6 sm:p-8"
        style={{
          background:
            "linear-gradient(120deg, color-mix(in srgb, var(--accent) 18%, var(--color-surface)) 0%, var(--color-surface) 52%, color-mix(in srgb, var(--accent) 8%, var(--color-surface)) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{
            background:
              "color-mix(in srgb, var(--accent) 22%, transparent)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-28 right-1/3 h-56 w-56 rounded-full blur-3xl"
          style={{
            background:
              "color-mix(in srgb, var(--accent-border) 12%, transparent)",
          }}
        />

        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Button
              aria-label="Вернуться к вакансиям"
              className="h-11 w-11 shrink-0 rounded-full p-0"
              onClick={() => navigate("/vacancies")}
              type="button"
              variant="ghost"
            >
              <FiArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="app-accent-soft app-accent-text inline-flex items-center gap-2 rounded-full border border-[var(--accent-border)] px-3 py-1 text-xs font-black uppercase tracking-[0.14em]">
                  <FiBriefcase className="h-3.5 w-3.5" />
                  Подбор персонала
                </span>
                <span className="app-muted text-xs font-bold">
                  {isEdit ? "Изменение существующей позиции" : "Создание позиции"}
                </span>
              </div>
              <h1 className="app-text text-3xl font-black tracking-tight sm:text-4xl">
                {pageTitle}
              </h1>
              <p className="app-text-soft mt-3 max-w-2xl text-sm font-medium leading-6 sm:text-base">
                Выберите должность, настройте параметры и соберите понятный профиль
                требований из hard и soft skills.
              </p>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:min-w-[390px]">
            <HeroMetric
              label="Должность"
              value={selectedPositionLabel ?? "Не выбрана"}
            />
            <HeroMetric
              label="Профиль требований"
              value={`${namedSkillsCount} из ${allSkills.length} навыков`}
            />
          </div>
        </div>
      </section>

      <form onSubmit={saveVacancy}>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <main className="space-y-6">
            <section className="app-surface app-border overflow-hidden rounded-[28px] border">
              <div className="h-1.5 bg-[var(--accent)]" />
              <div className="p-5 sm:p-7">
                <SectionHeading
                  description="Должность становится названием вакансии. Остальные параметры определяют, как позиция будет отображаться в подборе."
                  number="01"
                  title="Основная информация"
                />

                <div className="mt-6 grid gap-5">
                  <FormField label="Должность">
                    <Select
                      onValueChange={(positionId) =>
                        setForm((current) => ({ ...current, positionId }))
                      }
                      options={positions}
                      placeholder="Выберите должность из структуры компании"
                      value={form.positionId}
                    />
                  </FormField>

                  <div className="grid gap-5 md:grid-cols-3">
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
                    <FormField label="Открытых мест">
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
                </div>
              </div>
            </section>

            <div className="grid gap-6 2xl:grid-cols-2">
              <SkillSection
                description="Инструменты, технологии и профессиональные знания."
                icon={<FiTool className="h-5 w-5" />}
                onAdd={() => addSkill("hard")}
                onRemove={(key) => removeSkill("hard", key)}
                onUpdate={(key, patch) => updateSkill("hard", key, patch)}
                skills={form.hardSkills}
                title="Hard skills"
                tone="hard"
              />

              <SkillSection
                description="Коммуникация, взаимодействие и поведенческие качества."
                icon={<FiMessageCircle className="h-5 w-5" />}
                onAdd={() => addSkill("soft")}
                onRemove={(key) => removeSkill("soft", key)}
                onUpdate={(key, patch) => updateSkill("soft", key, patch)}
                skills={form.softSkills}
                title="Soft skills"
                tone="soft"
              />
            </div>

            <section className="app-surface app-border rounded-[28px] border p-5 sm:p-7">
              <SectionHeading
                description="Необязательная служебная информация. Она не является требованием к кандидату."
                number="03"
                title="Внутренняя заметка"
              />
              <div className="mt-6">
                <Textarea
                  className="min-h-32 resize-y"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Например: приоритетная вакансия, особенности согласования или комментарий для рекрутера"
                  rows={5}
                  value={form.note}
                />
              </div>
            </section>
          </main>

          <aside className="space-y-4 xl:sticky xl:top-[108px]">
            <section className="app-surface app-border overflow-hidden rounded-[28px] border">
              <div
                className="p-6 text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent-hover) 76%, #020617))",
                }}
              >
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/70">
                  Предпросмотр
                </p>
                <h2 className="mt-2 line-clamp-2 text-2xl font-black leading-tight">
                  {selectedPositionLabel?.split(" · ")[0] ?? "Название должности"}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm font-medium text-white/70">
                  {selectedPositionLabel
                    ? selectedPositionLabel.split(" · ").slice(1).join(" · ") ||
                      "Организационная структура"
                    : "Выберите должность, чтобы сформировать вакансию"}
                </p>
              </div>

              <div className="space-y-1 p-4">
                <SummaryRow
                  label="Статус"
                  value={vacancyStatusLabel(form.status)}
                />
                <SummaryRow
                  label="Занятость"
                  value={employmentTypeLabel(form.employmentType)}
                />
                <SummaryRow
                  label="Открытых мест"
                  value={form.openingsCount || "0"}
                />
                <SummaryRow
                  label="Hard skills"
                  value={String(form.hardSkills.length)}
                />
                <SummaryRow
                  label="Soft skills"
                  value={String(form.softSkills.length)}
                />
              </div>
            </section>

            <section className="app-surface app-border rounded-[24px] border p-5">
              <div className="flex items-center gap-3">
                <span className="app-accent-soft app-accent-text flex h-10 w-10 items-center justify-center rounded-xl">
                  <FiCheckCircle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="app-text font-black">Готовность формы</h3>
                  <p className="app-muted text-xs">
                    Заполните обязательные элементы
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <ChecklistItem
                  complete={Boolean(form.positionId)}
                  label="Выбрана должность"
                />
                <ChecklistItem
                  complete={allSkills.length > 0}
                  label="Добавлен хотя бы один навык"
                />
                <ChecklistItem
                  complete={
                    allSkills.length > 0 && namedSkillsCount === allSkills.length
                  }
                  label="У всех навыков есть названия"
                />
              </div>
            </section>

            <section className="app-surface app-border rounded-[24px] border p-4">
              <Button
                className="w-full"
                disabled={!canSave}
                leftIcon={<FiSave className="h-4 w-4" />}
                type="submit"
                variant="primary"
              >
                {isEdit ? "Сохранить изменения" : "Создать вакансию"}
              </Button>
              <Button
                className="mt-2 w-full"
                onClick={() => navigate("/vacancies")}
                type="button"
                variant="ghost"
              >
                Отмена
              </Button>
              <p className="app-muted mt-3 text-center text-xs leading-5">
                Вакансию можно будет отредактировать после сохранения.
              </p>
            </section>
          </aside>
        </div>
      </form>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="app-surface app-border min-w-0 rounded-2xl border px-4 py-3 shadow-sm">
      <p className="app-muted text-[11px] font-black uppercase tracking-[0.12em]">
        {label}
      </p>
      <p className="app-text mt-1 truncate text-sm font-black" title={value}>
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  description,
  number,
  title,
}: {
  description: string;
  number: string;
  title: string;
}): JSX.Element {
  return (
    <div className="flex items-start gap-4">
      <span className="app-accent-soft app-accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black">
        {number}
      </span>
      <div>
        <h2 className="app-text text-xl font-black tracking-tight">{title}</h2>
        <p className="app-muted mt-1 max-w-3xl text-sm leading-6">{description}</p>
      </div>
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
  tone,
}: {
  description: string;
  icon: JSX.Element;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onUpdate: (key: string, patch: Partial<VacancySkillState>) => void;
  skills: VacancySkillState[];
  title: string;
  tone: VacancySkillType;
}): JSX.Element {
  const toneColor = tone === "hard" ? "var(--accent)" : "#a855f7";
  const sectionNumber = tone === "hard" ? "02A" : "02B";

  return (
    <section
      className="app-border overflow-hidden rounded-[28px] border"
      style={{
        background: `linear-gradient(145deg, color-mix(in srgb, ${toneColor} 10%, var(--color-surface)), var(--color-surface) 38%)`,
        borderColor: `color-mix(in srgb, ${toneColor} 30%, var(--color-border))`,
      }}
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                background: `color-mix(in srgb, ${toneColor} 16%, transparent)`,
                borderColor: `color-mix(in srgb, ${toneColor} 40%, transparent)`,
                color: toneColor,
              }}
            >
              {icon}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-[11px] font-black uppercase tracking-[0.14em]"
                  style={{ color: toneColor }}
                >
                  Этап {sectionNumber}
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-black"
                  style={{
                    background: `color-mix(in srgb, ${toneColor} 13%, transparent)`,
                    color: toneColor,
                  }}
                >
                  {skills.length}
                </span>
              </div>
              <h2 className="app-text mt-1 text-xl font-black tracking-tight">
                {title}
              </h2>
              <p className="app-muted mt-1 text-sm leading-5">{description}</p>
            </div>
          </div>

          <Button
            className="shrink-0"
            leftIcon={<FiPlus className="h-4 w-4" />}
            onClick={onAdd}
            style={{
              borderColor: `color-mix(in srgb, ${toneColor} 38%, var(--color-border))`,
            }}
            type="button"
            variant="secondary"
          >
            Добавить
          </Button>
        </div>

        <div className="mt-5 flex items-center gap-2 text-xs font-bold">
          <span className="app-muted">Уровень оценивается от 1 до 10</span>
          <FiChevronRight className="app-muted h-3.5 w-3.5" />
          <span className="app-muted">вес важности — от 1 до 5</span>
        </div>

        {skills.length === 0 ? (
          <button
            className="app-surface app-border app-muted mt-5 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition hover:border-[var(--accent-border)]"
            onClick={onAdd}
            type="button"
          >
            <FiPlus className="mb-2 h-5 w-5" />
            <span className="text-sm font-black">Добавить первый навык</span>
            <span className="mt-1 text-xs">Категория пока пустая</span>
          </button>
        ) : (
          <div className="mt-5 space-y-3">
            {skills.map((skill, index) => (
              <article
                className="app-surface app-border rounded-[22px] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                key={skill.key}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black"
                      style={{
                        background: `color-mix(in srgb, ${toneColor} 14%, transparent)`,
                        color: toneColor,
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="app-text text-sm font-black">
                        {skill.name.trim() || "Новый навык"}
                      </p>
                      <p className="app-muted text-xs">{title}</p>
                    </div>
                  </div>
                  <Button
                    aria-label="Удалить навык"
                    className="h-9 w-9 rounded-xl p-0"
                    onClick={() => onRemove(skill.key)}
                    type="button"
                    variant="ghost"
                  >
                    <FiX className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px_100px]">
                  <label className="grid gap-1.5">
                    <span className="app-muted text-xs font-bold">
                      Название навыка
                    </span>
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
                  </label>
                  <label className="grid gap-1.5">
                    <span className="app-muted text-xs font-bold">
                      Уровень / 10
                    </span>
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
                  </label>
                  <label className="grid gap-1.5">
                    <span className="app-muted text-xs font-bold">Вес / 5</span>
                    <Input
                      aria-label="Вес навыка"
                      max="5"
                      min="1"
                      onChange={(event) =>
                        onUpdate(skill.key, {
                          weight: Number(event.target.value),
                        })
                      }
                      required
                      type="number"
                      value={skill.weight}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-2 py-2.5">
      <span className="app-muted text-sm font-semibold">{label}</span>
      <span className="app-text text-right text-sm font-black">{value}</span>
    </div>
  );
}

function ChecklistItem({
  complete,
  label,
}: {
  complete: boolean;
  label: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span
        className={[
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
          complete
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500"
            : "app-border app-muted",
        ].join(" ")}
      >
        {complete && <FiCheck className="h-3.5 w-3.5" />}
      </span>
      <span className={complete ? "app-text text-sm font-bold" : "app-muted text-sm"}>
        {label}
      </span>
    </div>
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

function vacancyStatusLabel(value: SaveVacancyParams["status"]): string {
  return vacancyStatusOptions.find((item) => item.value === value)?.label ?? value;
}

function employmentTypeLabel(
  value: SaveVacancyParams["employmentType"],
): string {
  return employmentTypeOptions.find((item) => item.value === value)?.label ?? value;
}

function errorMessage(error: unknown, fallback: string): string {
  const parts = error instanceof Error ? error.message.split("Error: ") : [];
  return parts.length > 0 ? parts[parts.length - 1] : fallback;
}
