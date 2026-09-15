import type {
  AdvanceCandidateParams,
  HireCandidateParams,
  HrRecord,
  RecruitmentListParams,
  RejectCandidateParams,
  SaveCandidateParams,
  SaveVacancyParams,
} from "../../src/shared/types/hr";
import { RecruitmentRepository } from "../repositories/recruitmentRepository";
import { EmployeeEmploymentService } from "./employeeEmploymentService";

export class RecruitmentService {
  constructor(
    private readonly repository: RecruitmentRepository,
    private readonly employmentService: EmployeeEmploymentService,
  ) {}

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
    assertOptionalDate(params.birthDate, "дату рождения");

    const vacancy = this.repository.getVacancy(params.vacancyId);
    if (!vacancy) throw new Error("Вакансия не найдена");

    const existing = params.id
      ? this.repository.getCandidate(assertId(params.id, "кандидата"))
      : null;
    if (params.id && !existing) throw new Error("Кандидат не найден");

    if (!existing) {
      if (
        Number(vacancy.vacancy.is_archived) === 1 ||
        String(vacancy.vacancy.status) !== "open"
      ) {
        throw new Error("Добавлять кандидатов можно только в открытую вакансию");
      }
      if (
        Number(vacancy.vacancy.hired_count ?? 0) >=
        Number(vacancy.vacancy.openings_count ?? 1)
      ) {
        throw new Error("Все места по вакансии уже заполнены");
      }
    } else {
      if (Number(existing.candidate.vacancy_id) !== params.vacancyId) {
        throw new Error("Вакансию кандидата нельзя изменить после регистрации");
      }
      if (
        existing.candidate.employee_id ||
        existing.candidate.status === "hired"
      ) {
        throw new Error(
          "Данные принятого кандидата сохранены как история. Изменяйте данные в карточке сотрудника",
        );
      }
      if (existing.candidate.status === "rejected") {
        throw new Error("Отклонённый кандидат сохранён как завершённая история подбора");
      }
    }

    const vacancySkillIds = new Set(
      vacancy.skills.map((skill) => Number(skill.id)),
    );
    const skillIds = new Set<number>();
    params.skillScores.forEach((skill) => {
      assertId(skill.vacancySkillId, "навыка");
      if (!vacancySkillIds.has(skill.vacancySkillId)) {
        throw new Error("Один из оцениваемых навыков не принадлежит вакансии кандидата");
      }
      if (skillIds.has(skill.vacancySkillId)) {
        throw new Error("Оценка одного навыка указана несколько раз");
      }
      skillIds.add(skill.vacancySkillId);
      assertRange(skill.score, 0, 10, "Оценка кандидата");
    });

    return this.repository.saveCandidate(params);
  }

  advanceCandidate(params: AdvanceCandidateParams) {
    assertId(params.candidateId, "кандидата");
    if (params.reason && params.reason.length > 2000) {
      throw new Error("Комментарий к переходу слишком длинный");
    }
    return this.repository.advanceCandidate(params);
  }

  rejectCandidate(params: RejectCandidateParams) {
    assertId(params.candidateId, "кандидата");
    if (!params.reason.trim()) {
      throw new Error("Укажите причину отклонения кандидата");
    }
    if (params.reason.length > 2000) {
      throw new Error("Причина отклонения слишком длинная");
    }
    return this.repository.rejectCandidate({
      candidateId: params.candidateId,
      reason: params.reason.trim(),
    });
  }

  hireCandidate(params: HireCandidateParams) {
    assertId(params.candidateId, "кандидата");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.hireDate)) {
      throw new Error("Укажите корректную дату выхода на работу");
    }
    if (!Number.isFinite(params.salary) || params.salary < 0) {
      throw new Error("Укажите корректный оклад");
    }
    if (params.lastName !== undefined && !params.lastName.trim()) {
      throw new Error("Укажите фамилию сотрудника");
    }
    if (params.firstName !== undefined && !params.firstName.trim()) {
      throw new Error("Укажите имя сотрудника");
    }
    assertOptionalDate(params.birthDate, "дату рождения");
    assertOptionalDate(params.contractDate, "дату договора");
    assertOptionalDate(params.contractEndDate, "дату окончания договора");
    assertOptionalDate(params.probationEndDate, "дату окончания испытательного срока");

    const profile = this.repository.getCandidate(params.candidateId);
    if (!profile) throw new Error("Кандидат не найден");
    if (profile.candidate.employee_id) {
      throw new Error("Кандидат уже принят на работу");
    }
    if (profile.candidate.status !== "offer") {
      throw new Error("Принять на работу можно кандидата на этапе «Оффер»");
    }

    return this.repository.hireCandidate(params, (candidate) =>
      this.employmentService.createHiredEmployee(
        employeeRecordFromCandidate(candidate, params),
        {
          enterpriseId: Number(candidate.enterprise_id),
        },
      ),
    );
  }

  deleteCandidate(id: number) {
    this.repository.deleteCandidate(assertId(id, "кандидата"));
    return { success: true as const };
  }
}

function employeeRecordFromCandidate(
  candidate: HrRecord,
  params: HireCandidateParams,
): HrRecord {
  const addressCountry = submittedText(params.addressCountry, candidate.address_country);
  const addressCity = submittedText(params.addressCity, candidate.address_city);
  const addressStreet = submittedText(params.addressStreet, candidate.address_street);
  const addressHouse = submittedText(params.addressHouse, candidate.address_house);
  const addressApartment = submittedText(
    params.addressApartment,
    candidate.address_apartment,
  );

  return {
    enterprise_id: Number(candidate.enterprise_id),
    department_id: Number(candidate.department_id),
    position_id: Number(candidate.position_id),
    employee_number: params.employeeNumber?.trim() || null,
    last_name:
      submittedText(params.lastName, candidate.last_name) ??
      String(candidate.last_name ?? "").trim(),
    first_name:
      submittedText(params.firstName, candidate.first_name) ??
      String(candidate.first_name ?? "").trim(),
    middle_name: submittedText(params.middleName, candidate.middle_name),
    birth_date: submittedText(params.birthDate, candidate.birth_date),
    gender: submittedText(params.gender, candidate.gender),
    phone: submittedText(params.phone, candidate.phone),
    email:
      submittedText(params.email, candidate.email)?.toLowerCase() ?? null,
    address_country: addressCountry,
    address_city: addressCity,
    address_street: addressStreet,
    address_house: addressHouse,
    address_apartment: addressApartment,
    address:
      submittedText(params.address, candidate.address) ??
      buildAddress(
        addressCountry,
        addressCity,
        addressStreet,
        addressHouse,
        addressApartment,
      ),
    hire_date: params.hireDate,
    salary: params.salary,
    employment_type: String(
      candidate.vacancy_employment_type ??
        candidate.employment_type ??
        "full_time",
    ),
    contract_number: params.contractNumber?.trim() || null,
    contract_date: params.contractDate || null,
    contract_end_date: params.contractEndDate || null,
    probation_end_date: params.probationEndDate || null,
    workplace: params.workplace?.trim() || null,
  };
}

function submittedText(
  submitted: unknown,
  fallback: unknown,
): string | null {
  if (submitted !== undefined) {
    const submittedValue = String(submitted ?? "").trim();
    return submittedValue || null;
  }
  const fallbackValue = String(fallback ?? "").trim();
  return fallbackValue || null;
}

function buildAddress(
  country: string | null,
  city: string | null,
  street: string | null,
  house: string | null,
  apartment: string | null,
): string | null {
  const locality = [country, city].filter(Boolean).join(", ");
  const streetLine = [
    street,
    house ? `д. ${house}` : null,
    apartment ? `кв. ${apartment}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return [locality, streetLine].filter(Boolean).join(", ") || null;
}

function assertOptionalDate(value: unknown, label: string): void {
  const normalized = String(value ?? "").trim();
  if (normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`Укажите корректную ${label}`);
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
