import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiBriefcase,
  FiCheck,
  FiCheckCircle,
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
  HrRecord,
  SaveVacancyParams,
  VacancySkillInput,
  VacancySkillType,
} from "../../shared/types/hr";
import {
  Button,
  IconButton,
  Input,
  LoadingState,
  Select,
  type SelectOption,
} from "../../shared/ui";

interface VacancySkillState extends VacancySkillInput {
  key: string;
}

interface VacancyFormState {
  enterpriseId: string;
  departmentId: string;
  positionId: string;
  status: SaveVacancyParams["status"];
  employmentType: SaveVacancyParams["employmentType"];
  openingsCount: string;
  hardSkills: VacancySkillState[];
  softSkills: VacancySkillState[];
}

const emptyForm = (): VacancyFormState => ({
  enterpriseId: "",
  departmentId: "",
  positionId: "",
  status: "open",
  employmentType: "full_time",
  openingsCount: "1",
  hardSkills: [newSkill("hard")],
  softSkills: [newSkill("soft")],
});

export function VacancyFormPage(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams();
  const vacancyId = id ? Number(id) : undefined;
  const isEdit = Number.isInteger(vacancyId) && Number(vacancyId) > 0;

  const [form, setForm] = useState<VacancyFormState>(emptyForm);
  const [enterprises, setEnterprises] = useState<HrRecord[]>([]);
  const [departments, setDepartments] = useState<HrRecord[]>([]);
  const [positions, setPositions] = useState<HrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [enterpriseRows, departmentRows, positionRows, profile] =
        await Promise.all([
          hrApiClient.list({
            entity: "enterprises",
            page: 1,
            pageSize: 100,
            orderBy: "name",
          }),
          hrApiClient.list({
            entity: "departments",
            page: 1,
            pageSize: 100,
            orderBy: "name",
          }),
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

      setEnterprises(enterpriseRows.items);
      setDepartments(departmentRows.items);
      setPositions(positionRows.items);

      if (!isEdit) {
        setForm(emptyForm());
        return;
      }

      if (!profile) throw new Error("Вакансия не найдена");
      const vacancy = profile.vacancy;
      const position = positionRows.items.find(
        (item) => Number(item.id) === Number(vacancy.position_id),
      );
      const department = departmentRows.items.find(
        (item) => Number(item.id) === Number(position?.department_id),
      );
      if (!position || !department) {
        throw new Error("Структура вакансии больше не существует");
      }

      const skills = profile.skills.map((skill) => ({
        id: Number(skill.id),
        key: `skill-${String(skill.id)}`,
        type: normalizeSkillType(skill.skill_type),
        name: String(skill.name ?? ""),
        requiredLevel: Number(skill.required_level ?? 5),
      }));

      setForm({
        enterpriseId: String(department.enterprise_id ?? ""),
        departmentId: String(department.id ?? ""),
        positionId: String(position.id ?? ""),
        status: String(vacancy.status) as VacancyFormState["status"],
        employmentType: String(
          vacancy.employment_type,
        ) as VacancyFormState["employmentType"],
        openingsCount: String(vacancy.openings_count ?? 1),
        hardSkills: skills.filter((skill) => skill.type === "hard"),
        softSkills: skills.filter((skill) => skill.type === "soft"),
      });
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

  const enterpriseOptions = useMemo<SelectOption[]>(
    () =>
      enterprises.map((item) => ({
        value: String(item.id),
        label: [item.legal_form, item.name].filter(Boolean).join(" · "),
      })),
    [enterprises],
  );

  const departmentOptions = useMemo<SelectOption[]>(
    () =>
      departments
        .filter(
          (item) =>
            !form.enterpriseId ||
            String(item.enterprise_id) === form.enterpriseId,
        )
        .map((item) => ({ value: String(item.id), label: String(item.name) })),
    [departments, form.enterpriseId],
  );

  const positionOptions = useMemo<SelectOption[]>(
    () =>
      positions
        .filter(
          (item) =>
            !form.departmentId || String(item.department_id) === form.departmentId,
        )
        .map((item) => ({ value: String(item.id), label: String(item.name) })),
    [form.departmentId, positions],
  );

  const selectedEnterprise = enterprises.find(
    (item) => String(item.id) === form.enterpriseId,
  );
  const selectedDepartment = departments.find(
    (item) => String(item.id) === form.departmentId,
  );
  const selectedPosition = positions.find(
    (item) => String(item.id) === form.positionId,
  );
  const allSkills = [...form.hardSkills, ...form.softSkills];
  const namedSkillsCount = allSkills.filter((skill) => skill.name.trim()).length;
  const canSave =
    Boolean(form.enterpriseId && form.departmentId && form.positionId) &&
    allSkills.length > 0 &&
    namedSkillsCount === allSkills.length &&
    Number(form.openingsCount) > 0 &&
    !isSaving;

  async function saveVacancy(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    try {
      await hrApiClient.saveVacancy({
        id: isEdit ? Number(vacancyId) : undefined,
        positionId: Number(form.positionId),
        status: form.status,
        employmentType: form.employmentType,
        openingsCount: Number(form.openingsCount),
        skills: allSkills.map(({ id: skillId, type, name, requiredLevel }) => ({
          id: skillId,
          type,
          name,
          requiredLevel,
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
      {isEdit && (
      <section className="app-surface app-border rounded-[30px] border p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <IconButton className="rounded-full" icon={<FiArrowLeft />} label="Вернуться к вакансиям" onClick={() => navigate("/vacancies")} size="lg" />
            <div>
              <span className="app-accent-soft app-accent-text inline-flex items-center gap-2 rounded-full border border-[var(--accent-border)] px-3 py-1 text-xs font-black uppercase tracking-[0.14em]">
                <FiBriefcase className="h-3.5 w-3.5" />
                Подбор персонала
              </span>
              <h1 className="app-text mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                {isEdit ? "Редактирование вакансии" : "Новая вакансия"}
              </h1>
              <p className="app-muted mt-2 max-w-2xl text-sm leading-6">
                Сначала выберите предприятие, затем отдел и должность. Так вакансия всегда привязана к существующей структуре компании.
              </p>
            </div>
          </div>
          <HeroMetric
            label="Вакансия"
            value={String(selectedPosition?.name ?? "Должность не выбрана")}
          />
        </div>
      </section>
      )}

      <form onSubmit={saveVacancy}>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <main className="space-y-6">
            <section className="app-surface app-border rounded-[28px] border p-5 sm:p-7">
              <SectionHeading
                description="Последовательный выбор исключает вакансии вне организационной структуры."
                number="01"
                title="Место вакансии в структуре"
              />
              <div className="mt-6 grid gap-5 md:grid-cols-3">
                <FormField label="Предприятие">
                  <Select
                    onValueChange={(enterpriseId) =>
                      setForm((current) => ({
                        ...current,
                        enterpriseId,
                        departmentId: "",
                        positionId: "",
                      }))
                    }
                    options={enterpriseOptions}
                    placeholder="Выберите предприятие"
                    value={form.enterpriseId}
                  />
                </FormField>
                <FormField label="Отдел">
                  <Select
                    disabled={!form.enterpriseId}
                    onValueChange={(departmentId) =>
                      setForm((current) => ({
                        ...current,
                        departmentId,
                        positionId: "",
                      }))
                    }
                    options={departmentOptions}
                    placeholder={
                      form.enterpriseId ? "Выберите отдел" : "Сначала предприятие"
                    }
                    value={form.departmentId}
                  />
                </FormField>
                <FormField label="Должность">
                  <Select
                    disabled={!form.departmentId}
                    onValueChange={(positionId) =>
                      setForm((current) => ({ ...current, positionId }))
                    }
                    options={positionOptions}
                    placeholder={
                      form.departmentId ? "Выберите должность" : "Сначала отдел"
                    }
                    value={form.positionId}
                  />
                </FormField>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-3">
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
              />
              <SkillSection
                description="Коммуникация, взаимодействие и поведенческие качества."
                icon={<FiMessageCircle className="h-5 w-5" />}
                onAdd={() => addSkill("soft")}
                onRemove={(key) => removeSkill("soft", key)}
                onUpdate={(key, patch) => updateSkill("soft", key, patch)}
                skills={form.softSkills}
                title="Soft skills"
              />
            </div>
          </main>

          <aside className="space-y-4 xl:sticky xl:top-[108px]">
            <section className="app-surface app-border rounded-[28px] border p-5">
              <p className="app-accent-text text-xs font-black uppercase tracking-[0.16em]">
                Выбранная структура
              </p>
              <div className="mt-4 space-y-1">
                <SummaryRow
                  label="Предприятие"
                  value={
                    selectedEnterprise
                      ? [selectedEnterprise.legal_form, selectedEnterprise.name]
                          .filter(Boolean)
                          .join(" · ")
                      : "—"
                  }
                />
                <SummaryRow
                  label="Отдел"
                  value={String(selectedDepartment?.name ?? "—")}
                />
                <SummaryRow
                  label="Должность"
                  value={String(selectedPosition?.name ?? "—")}
                />
                <SummaryRow
                  label="Открытых мест"
                  value={form.openingsCount || "0"}
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
                  <p className="app-muted text-xs">Заполните обязательные элементы</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <ChecklistItem complete={Boolean(form.enterpriseId)} label="Выбрано предприятие" />
                <ChecklistItem complete={Boolean(form.departmentId)} label="Выбран отдел" />
                <ChecklistItem complete={Boolean(form.positionId)} label="Выбрана должность" />
                <ChecklistItem
                  complete={allSkills.length > 0 && namedSkillsCount === allSkills.length}
                  label="Профиль навыков заполнен"
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
            </section>
          </aside>
        </div>
      </form>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="app-surface-muted app-border min-w-[260px] rounded-2xl border px-4 py-3">
      <p className="app-muted text-[11px] font-black uppercase tracking-[0.12em]">{label}</p>
      <p className="app-text mt-1 truncate text-sm font-black" title={value}>{value}</p>
    </div>
  );
}

function SectionHeading({ description, number, title }: { description: string; number: string; title: string }): JSX.Element {
  return (
    <div className="flex items-start gap-4">
      <span className="app-accent-soft app-accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black">{number}</span>
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
    <section className="app-surface app-border rounded-[28px] border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="app-accent-soft app-accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">{icon}</span>
          <div>
            <h2 className="app-text text-xl font-black tracking-tight">{title}</h2>
            <p className="app-muted mt-1 text-sm leading-5">{description}</p>
          </div>
        </div>
        <Button leftIcon={<FiPlus className="h-4 w-4" />} onClick={onAdd} type="button" variant="secondary">
          Добавить
        </Button>
      </div>

      <div className="app-surface-muted app-border mt-4 rounded-2xl border px-4 py-3">
        <p className="app-text-soft text-xs font-semibold leading-5">
          <strong className="app-text">Уровень</strong> — ожидаемое владение навыком по шкале 1–10.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {skills.length === 0 && (
          <button className="app-border app-muted w-full rounded-2xl border border-dashed p-7" onClick={onAdd} type="button">
            <FiPlus className="mx-auto mb-2 h-5 w-5" />
            <span className="text-sm font-black">Добавить первый навык</span>
          </button>
        )}
        {skills.map((skill, index) => (
          <article className="app-surface-muted app-border rounded-[22px] border p-4" key={skill.key}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="app-text text-sm font-black">{String(index + 1).padStart(2, "0")} · {skill.name.trim() || "Новый навык"}</p>
              <IconButton icon={<FiX />} label="Удалить навык" onClick={() => onRemove(skill.key)} size="sm" tone="danger" />
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px]">
              <SkillInputField label="Навык">
                <Input
                  aria-label={`${title}, навык ${index + 1}`}
                  onChange={(event) => onUpdate(skill.key, { name: event.target.value })}
                  placeholder={skill.type === "hard" ? "Например: SQL" : "Например: Командная работа"}
                  required
                  value={skill.name}
                />
              </SkillInputField>
              <SkillInputField hint="1–10" label="Уровень">
                <Input
                  aria-label="Требуемый уровень навыка от 1 до 10"
                  max="10"
                  min="1"
                  onChange={(event) => onUpdate(skill.key, { requiredLevel: Number(event.target.value) })}
                  required
                  type="number"
                  value={skill.requiredLevel}
                />
              </SkillInputField>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SkillInputField({ children, hint, label }: { children: JSX.Element; hint?: string; label: string }): JSX.Element {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center justify-between gap-2 px-1 text-xs font-black">
        <span className="app-text-soft">{label}</span>
        {hint && <span className="app-muted font-bold">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-2 py-2.5">
      <span className="app-muted text-sm font-semibold">{label}</span>
      <span className="app-text text-right text-sm font-black">{value}</span>
    </div>
  );
}

function ChecklistItem({ complete, label }: { complete: boolean; label: string }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className={["flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", complete ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500" : "app-border app-muted"].join(" ")}>
        {complete && <FiCheck className="h-3.5 w-3.5" />}
      </span>
      <span className={complete ? "app-text text-sm font-bold" : "app-muted text-sm"}>{label}</span>
    </div>
  );
}

function newSkill(type: VacancySkillType): VacancySkillState {
  return {
    key: `new-${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    name: "",
    requiredLevel: 5,
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
