import type {
  HireCandidateParams,
  RecruitmentListParams,
  SaveCandidateParams,
  SaveVacancyParams,
} from "../../src/shared/types/hr";
import { RecruitmentRepository } from "../repositories/recruitmentRepository";

export class RecruitmentService {
  constructor(private readonly repository: RecruitmentRepository) {}

  listVacancies(params: RecruitmentListParams) {
    return this.repository.listVacancies(params);
  }

  getVacancy(id: number) {
    return this.repository.getVacancy(assertId(id, "вакансии"));
  }

  saveVacancy(params: SaveVacancyParams) {
    assertId(params.positionId, "должности");
    if (!Number.isInteger(params.openingsCount) || params.openingsCount < 1) {
      throw new Error("Количество открытых мест должно быть не меньше 1");
    }
    if (params.skills.length === 0) {
      throw new Error("Добавьте хотя бы один hard или soft skill");
    }

    const names = new Set<string>();
    const skillIds = new Set<number>();
    params.skills.forEach((skill) => {
      if (skill.type !== "hard" && skill.type !== "soft") {
        throw new Error("Укажите корректный тип навыка");
      }
      const name = skill.name.trim().toLocaleLowerCase("ru");
      if (!name) throw new Error("Название навыка не может быть пустым");
      if (names.has(name)) throw new Error(`Навык «${skill.name}» повторяется`);
      names.add(name);
      if (skill.id) {
        if (skillIds.has(skill.id)) {
          throw new Error("Один навык вакансии передан несколько раз");
        }
        skillIds.add(skill.id);
      }
      assertRange(skill.requiredLevel, 1, 10, "Требуемый уровень навыка");
    });

    return this.repository.saveVacancy(params);
  }

  deleteVacancy(id: number) {
    this.repository.deleteVacancy(assertId(id, "вакансии"));
    return { success: true as const };
  }

  listCandidates(params: RecruitmentListParams) {
    return this.repository.listCandidates(params);
  }

  getCandidate(id: number) {
    return this.repository.getCandidate(assertId(id, "кандидата"));
  }

  saveCandidate(params: SaveCandidateParams) {
    if (!params.lastName.trim() || !params.firstName.trim()) {
      throw new Error("Укажите имя и фамилию кандидата");
    }
    assertId(params.vacancyId, "вакансии");

    const existing = params.id
      ? this.repository.getCandidate(assertId(params.id, "кандидата"))
      : null;
    if (params.id && !existing) throw new Error("Кандидат не найден");

    const isAlreadyHired = Boolean(existing?.candidate.employee_id);
    if (params.status === "hired" && !isAlreadyHired) {
      throw new Error(
        "Для приёма кандидата используйте действие «Принять на работу»",
      );
    }
    if (isAlreadyHired && params.status !== "hired") {
      throw new Error("Принятого сотрудника нельзя вернуть на этап подбора");
    }
    if (
      isAlreadyHired &&
      Number(existing?.candidate.vacancy_id) !== params.vacancyId
    ) {
      throw new Error("Нельзя изменить вакансию уже принятого кандидата");
    }

    const skillIds = new Set<number>();
    params.skillScores.forEach((skill) => {
      assertId(skill.vacancySkillId, "навыка");
      if (skillIds.has(skill.vacancySkillId)) {
        throw new Error("Оценка одного навыка указана несколько раз");
      }
      skillIds.add(skill.vacancySkillId);
      assertRange(skill.score, 0, 10, "Оценка кандидата");
    });

    return this.repository.saveCandidate(params);
  }

  hireCandidate(params: HireCandidateParams) {
    assertId(params.candidateId, "кандидата");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.hireDate)) {
      throw new Error("Укажите корректную дату выхода на работу");
    }
    if (!Number.isFinite(params.salary) || params.salary < 0) {
      throw new Error("Укажите корректный оклад");
    }

    const profile = this.repository.getCandidate(params.candidateId);
    if (!profile) throw new Error("Кандидат не найден");
    if (profile.candidate.employee_id) {
      throw new Error("Кандидат уже принят на работу");
    }
    if (profile.candidate.status !== "offer") {
      throw new Error("Принять на работу можно кандидата на этапе «Оффер»");
    }

    return this.repository.hireCandidate(params);
  }

  deleteCandidate(id: number) {
    this.repository.deleteCandidate(assertId(id, "кандидата"));
    return { success: true as const };
  }
}

function assertId(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Укажите корректный идентификатор ${label}`);
  }
  return value;
}

function assertRange(
  value: number,
  min: number,
  max: number,
  label: string,
): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} должен быть целым числом от ${min} до ${max}`);
  }
}
