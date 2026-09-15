import type Database from "better-sqlite3";

import type {
  AdvanceCandidateParams,
  CandidateProfile,
  HireCandidateParams,
  RecruitmentListParams,
  RejectCandidateParams,
  SaveCandidateParams,
  SaveVacancyParams,
  VacancyProfile,
} from "../../src/shared/types/hr";
import type { HrRecord } from "../../src/shared/types/hr";

export class RecruitmentRepository {
  constructor(private readonly database: Database.Database) {}

  listVacancies(params: RecruitmentListParams): HrRecord[] {
    const search = params.search?.trim() ?? "";
    return this.database
      .prepare(
        `SELECT
           vacancies.id,
           vacancies.position_id,
           vacancies.status,
           vacancies.employment_type,
           vacancies.openings_count,
           vacancies.created_at,
           vacancies.updated_at,
           positions.name AS position_name,
           departments.id AS department_id,
           departments.name AS department_name,
           enterprises.id AS enterprise_id,
           enterprises.name AS enterprise_name,
           COUNT(DISTINCT vacancy_skills.id) AS skills_count,
           COUNT(DISTINCT CASE
             WHEN vacancy_skills.skill_type = 'hard' THEN vacancy_skills.id
           END) AS hard_skills_count,
           COUNT(DISTINCT CASE
             WHEN vacancy_skills.skill_type = 'soft' THEN vacancy_skills.id
           END) AS soft_skills_count,
           COUNT(DISTINCT candidates.id) AS candidates_count,
           COUNT(DISTINCT CASE
             WHEN candidates.employee_id IS NOT NULL THEN candidates.id
           END) AS hired_count,
           GROUP_CONCAT(DISTINCT CASE
             WHEN vacancy_skills.skill_type = 'hard' THEN vacancy_skills.name
           END) AS hard_skills_summary,
           GROUP_CONCAT(DISTINCT CASE
             WHEN vacancy_skills.skill_type = 'soft' THEN vacancy_skills.name
           END) AS soft_skills_summary
         FROM vacancies
         JOIN positions ON positions.id = vacancies.position_id
         LEFT JOIN departments ON departments.id = positions.department_id
         LEFT JOIN enterprises ON enterprises.id = departments.enterprise_id
         LEFT JOIN vacancy_skills ON vacancy_skills.vacancy_id = vacancies.id
         LEFT JOIN candidates ON candidates.vacancy_id = vacancies.id
         WHERE vacancies.is_archived = 0
           AND (
             @search = ''
             OR positions.name LIKE @pattern
             OR departments.name LIKE @pattern
             OR enterprises.name LIKE @pattern
             OR EXISTS (
               SELECT 1
               FROM vacancy_skills AS searched_skill
               WHERE searched_skill.vacancy_id = vacancies.id
                 AND searched_skill.name LIKE @pattern
             )
           )
         GROUP BY vacancies.id
         ORDER BY
           CASE vacancies.status
             WHEN 'open' THEN 1
             WHEN 'draft' THEN 2
             WHEN 'paused' THEN 3
             ELSE 4
           END,
           vacancies.updated_at DESC,
           vacancies.id DESC`,
      )
      .all({ search, pattern: `%${search}%` }) as HrRecord[];
  }

  getVacancy(id: number): VacancyProfile | null {
    const vacancy = this.database
      .prepare(
        `SELECT
           vacancies.id,
           vacancies.position_id,
           vacancies.status,
           vacancies.employment_type,
           vacancies.openings_count,
           vacancies.is_archived,
           (SELECT COUNT(*)
            FROM candidates
            WHERE candidates.vacancy_id = vacancies.id) AS candidates_count,
           (SELECT COUNT(*)
            FROM candidates
            WHERE candidates.vacancy_id = vacancies.id
              AND candidates.employee_id IS NOT NULL) AS hired_count,
           vacancies.archived_at,
           vacancies.archive_reason,
           vacancies.created_at,
           vacancies.updated_at,
           positions.name AS position_name,
           departments.id AS department_id,
           departments.name AS department_name,
           enterprises.id AS enterprise_id,
           enterprises.name AS enterprise_name
         FROM vacancies
         JOIN positions ON positions.id = vacancies.position_id
         LEFT JOIN departments ON departments.id = positions.department_id
         LEFT JOIN enterprises ON enterprises.id = departments.enterprise_id
         WHERE vacancies.id = ?
         LIMIT 1`,
      )
      .get(id) as HrRecord | undefined;

    if (!vacancy) return null;

    const skills = this.database
      .prepare(
        `SELECT *
         FROM vacancy_skills
         WHERE vacancy_id = ?
         ORDER BY
           CASE skill_type WHEN 'hard' THEN 1 ELSE 2 END,
           required_level DESC,
           name ASC`,
      )
      .all(id) as HrRecord[];

    return { vacancy, skills };
  }

  saveVacancy(params: SaveVacancyParams): VacancyProfile {
    const save = this.database.transaction(() => {
      const vacancyId = params.id
        ? this.updateVacancy(params)
        : this.insertVacancy(params);
      this.syncVacancySkills(vacancyId, params.skills);
      if (params.status === "closed") {
        this.rejectActiveCandidatesForVacancy(
          vacancyId,
          "Вакансия закрыта работодателем",
        );
      }
      return vacancyId;
    });

    const vacancyId = save();
    const profile = this.getVacancy(vacancyId);
    if (!profile) throw new Error("Сохранённая вакансия не найдена");
    return profile;
  }

  deleteVacancy(id: number): void {
    // The database owns the historical deletion invariant: migration 029 turns
    // DELETE into archival when candidates already reference the vacancy, while
    // an unused erroneous vacancy is removed physically.
    this.database.prepare("DELETE FROM vacancies WHERE id = ?").run(id);
  }

  listCandidates(params: RecruitmentListParams): HrRecord[] {
    const search = params.search?.trim() ?? "";
    return this.database
      .prepare(
        `SELECT
           candidates.*,
           vacancies.status AS vacancy_status,
           vacancies.employment_type AS vacancy_employment_type,
           vacancies.openings_count AS vacancy_openings_count,
           vacancies.is_archived AS vacancy_is_archived,
           positions.name AS vacancy_title,
           positions.name AS position_name,
           departments.name AS department_name,
           enterprises.name AS enterprise_name,
           COALESCE(
             (SELECT ROUND(
               100.0 * AVG(
                 MIN(
                   CAST(COALESCE(candidate_score.score, 0) AS REAL) /
                     vacancy_skill.required_level,
                   1.0
                 )
               ),
               0
             )
             FROM vacancy_skills AS vacancy_skill
             LEFT JOIN candidate_skill_scores AS candidate_score
               ON candidate_score.vacancy_skill_id = vacancy_skill.id
              AND candidate_score.candidate_id = candidates.id
             WHERE vacancy_skill.vacancy_id = candidates.vacancy_id),
             0
           ) AS match_percentage,
           (SELECT COUNT(*)
            FROM vacancy_skills
            WHERE vacancy_skills.vacancy_id = candidates.vacancy_id) AS skills_count,
           (SELECT GROUP_CONCAT(
              vacancy_skill.name || ': ' ||
              COALESCE(candidate_score.score, 0) || '/10' ||
              ' (треб. ' || vacancy_skill.required_level || ')',
              char(31)
            )
            FROM vacancy_skills AS vacancy_skill
            LEFT JOIN candidate_skill_scores AS candidate_score
              ON candidate_score.vacancy_skill_id = vacancy_skill.id
             AND candidate_score.candidate_id = candidates.id
            WHERE vacancy_skill.vacancy_id = candidates.vacancy_id) AS skills_summary
         FROM candidates
         JOIN vacancies ON vacancies.id = candidates.vacancy_id
         JOIN positions ON positions.id = vacancies.position_id
         LEFT JOIN departments ON departments.id = positions.department_id
         LEFT JOIN enterprises ON enterprises.id = departments.enterprise_id
         WHERE @search = ''
           OR candidates.last_name LIKE @pattern
           OR candidates.first_name LIKE @pattern
           OR candidates.middle_name LIKE @pattern
           OR candidates.phone LIKE @pattern
           OR candidates.email LIKE @pattern
           OR positions.name LIKE @pattern
           OR departments.name LIKE @pattern
           OR enterprises.name LIKE @pattern
         ORDER BY match_percentage DESC, candidates.updated_at DESC, candidates.id DESC`,
      )
      .all({ search, pattern: `%${search}%` }) as HrRecord[];
  }

  getCandidate(id: number): CandidateProfile | null {
    const candidate = this.database
      .prepare(
        `SELECT
           candidates.*,
           vacancies.status AS vacancy_status,
           vacancies.employment_type AS vacancy_employment_type,
           vacancies.openings_count AS vacancy_openings_count,
           vacancies.is_archived AS vacancy_is_archived,
           positions.name AS vacancy_title,
           positions.name AS position_name,
           departments.name AS department_name,
           enterprises.name AS enterprise_name
         FROM candidates
         JOIN vacancies ON vacancies.id = candidates.vacancy_id
         JOIN positions ON positions.id = vacancies.position_id
         LEFT JOIN departments ON departments.id = positions.department_id
         LEFT JOIN enterprises ON enterprises.id = departments.enterprise_id
         WHERE candidates.id = ?
         LIMIT 1`,
      )
      .get(id) as HrRecord | undefined;

    if (!candidate) return null;

    const vacancyId = Number(candidate.vacancy_id);
    const vacancySkills = this.database
      .prepare(
        `SELECT * FROM vacancy_skills
         WHERE vacancy_id = ?
         ORDER BY CASE skill_type WHEN 'hard' THEN 1 ELSE 2 END,
                  required_level DESC, name ASC`,
      )
      .all(vacancyId) as HrRecord[];
    const skillScores = this.database
      .prepare(
        `SELECT * FROM candidate_skill_scores WHERE candidate_id = ?`,
      )
      .all(id) as HrRecord[];
    const statusHistory = this.database
      .prepare(
        `SELECT * FROM candidate_status_history
         WHERE candidate_id = ? ORDER BY changed_at DESC, id DESC`,
      )
      .all(id) as HrRecord[];

    return { candidate, vacancySkills, skillScores, statusHistory };
  }

  saveCandidate(params: SaveCandidateParams): CandidateProfile {
    const save = this.database.transaction(() => {
      const candidateId = params.id
        ? this.updateCandidate(params)
        : this.insertCandidate(params);

      this.database
        .prepare("DELETE FROM candidate_skill_scores WHERE candidate_id = ?")
        .run(candidateId);

      const insertScore = this.database.prepare(
        `INSERT INTO candidate_skill_scores (
           candidate_id, vacancy_skill_id, score
         ) VALUES (?, ?, ?)`,
      );
      params.skillScores.forEach((item) => {
        insertScore.run(candidateId, item.vacancySkillId, item.score);
      });

      return candidateId;
    });

    const candidateId = save();
    const profile = this.getCandidate(candidateId);
    if (!profile) throw new Error("Сохранённый кандидат не найден");
    return profile;
  }

  advanceCandidate(params: AdvanceCandidateParams): CandidateProfile {
    const advance = this.database.transaction(() => {
      const profile = this.getCandidate(params.candidateId);
      if (!profile) throw new Error("Кандидат не найден");

      const candidate = profile.candidate;
      if (Number(candidate.vacancy_is_archived) === 1) {
        throw new Error("Нельзя продолжить подбор по архивной вакансии");
      }
      if (String(candidate.vacancy_status) !== "open") {
        throw new Error("Продвигать кандидата можно только по открытой вакансии");
      }
      if (candidate.employee_id || candidate.status === "hired") {
        throw new Error("Кандидат уже принят на работу");
      }
      if (candidate.status === "rejected") {
        throw new Error("Отклонённый кандидат уже завершил процесс подбора");
      }

      const nextStatus = nextCandidateStatus(String(candidate.status ?? ""));
      if (!nextStatus) {
        throw new Error(
          candidate.status === "offer"
            ? "Кандидат уже на этапе «Оффер». Используйте действие «Принять на работу» или «Отклонить»"
            : "Для текущего этапа нет следующего шага",
        );
      }

      this.database
        .prepare(
          `UPDATE candidates
           SET status = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .run(nextStatus, params.candidateId);
      this.updateLatestStatusReason(
        params.candidateId,
        params.reason?.trim() ||
          `Переход: ${candidateStatusName(String(candidate.status))} → ${candidateStatusName(nextStatus)}`,
      );
    });

    advance();
    const profile = this.getCandidate(params.candidateId);
    if (!profile) throw new Error("Кандидат не найден после изменения этапа");
    return profile;
  }

  rejectCandidate(params: RejectCandidateParams): CandidateProfile {
    const reject = this.database.transaction(() => {
      const profile = this.getCandidate(params.candidateId);
      if (!profile) throw new Error("Кандидат не найден");
      const candidate = profile.candidate;
      if (candidate.employee_id || candidate.status === "hired") {
        throw new Error("Принятого кандидата нельзя отклонить");
      }
      if (candidate.status === "rejected") {
        throw new Error("Кандидат уже отклонён");
      }

      this.database
        .prepare(
          `UPDATE candidates
           SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .run(params.candidateId);
      this.updateLatestStatusReason(params.candidateId, params.reason.trim());
    });

    reject();
    const profile = this.getCandidate(params.candidateId);
    if (!profile) throw new Error("Кандидат не найден после отклонения");
    return profile;
  }

  hireCandidate(
    params: HireCandidateParams,
    createEmployee: (candidate: HrRecord) => HrRecord,
  ): HrRecord {
    const hire = this.database.transaction(() => {
      const candidate = this.database
        .prepare(
          `SELECT candidate.*,
                  vacancy.position_id,
                  vacancy.employment_type,
                  vacancy.openings_count,
                  vacancy.is_archived,
                  vacancy.status AS vacancy_status,
                  position.department_id,
                  department.enterprise_id
           FROM candidates AS candidate
           JOIN vacancies AS vacancy ON vacancy.id = candidate.vacancy_id
           JOIN positions AS position ON position.id = vacancy.position_id
           JOIN departments AS department ON department.id = position.department_id
           WHERE candidate.id = ? LIMIT 1`,
        )
        .get(params.candidateId) as HrRecord | undefined;
      if (!candidate) throw new Error("Кандидат не найден");
      if (Number(candidate.is_archived) === 1) {
        throw new Error("Нельзя принять кандидата из архивной вакансии");
      }
      if (candidate.employee_id) {
        throw new Error("Для этого кандидата сотрудник уже создан");
      }
      if (candidate.status !== "offer") {
        throw new Error("Принять на работу можно только кандидата на этапе «Оффер»");
      }
      if (candidate.vacancy_status !== "open") {
        throw new Error("Принимать кандидата можно только по открытой вакансии");
      }

      const hiredCountBefore = Number(
        this.database
          .prepare(
            `SELECT COUNT(*) FROM candidates
             WHERE vacancy_id = ? AND employee_id IS NOT NULL`,
          )
          .pluck()
          .get(candidate.vacancy_id) ?? 0,
      );
      if (hiredCountBefore >= Number(candidate.openings_count ?? 1)) {
        throw new Error("Все места по вакансии уже заполнены");
      }

      const enterpriseId = Number(candidate.enterprise_id);
      if (!Number.isInteger(enterpriseId) || enterpriseId < 1) {
        throw new Error("Для вакансии не определено предприятие");
      }

      const employee = createEmployee(candidate);
      const employeeId = Number(employee.id);
      if (!Number.isInteger(employeeId) || employeeId < 1) {
        throw new Error("Созданный сотрудник не найден");
      }

      // Candidate contact data is historical recruitment data. It is preserved
      // after hire instead of being cleared merely to satisfy an e-mail uniqueness
      // workaround.
      this.database
        .prepare(
          `UPDATE candidates
           SET status = 'hired', employee_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .run(employeeId, params.candidateId);
      this.updateLatestStatusReason(
        params.candidateId,
        "Кандидат принят на работу",
      );

      const hiredCount = Number(
        this.database
          .prepare(
            `SELECT COUNT(*) FROM candidates
             WHERE vacancy_id = ? AND employee_id IS NOT NULL`,
          )
          .pluck()
          .get(candidate.vacancy_id) ?? 0,
      );
      if (hiredCount >= Number(candidate.openings_count ?? 1)) {
        this.database
          .prepare(
            `UPDATE vacancies
             SET status = 'closed', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .run(candidate.vacancy_id);
        this.rejectActiveCandidatesForVacancy(
          Number(candidate.vacancy_id),
          "Вакансия закрыта: все доступные места заполнены",
        );
      }

      return employee;
    });

    return hire();
  }

  deleteCandidate(id: number): void {
    const candidate = this.database
      .prepare(
        `SELECT id, status, employee_id,
                EXISTS (
                  SELECT 1
                  FROM candidate_status_history
                  WHERE candidate_id = candidates.id
                    AND previous_status IS NOT NULL
                ) AS has_progress_history
         FROM candidates
         WHERE id = ? LIMIT 1`,
      )
      .get(id) as
      | {
          id: number;
          status: string;
          employee_id: number | null;
          has_progress_history: number;
        }
      | undefined;
    if (!candidate) throw new Error("Кандидат не найден");
    if (
      candidate.employee_id ||
      candidate.status !== "new" ||
      candidate.has_progress_history
    ) {
      throw new Error(
        "Удалить можно только ошибочно созданного нового кандидата без истории подбора",
      );
    }
    this.database.prepare("DELETE FROM candidates WHERE id = ?").run(id);
  }

  private insertVacancy(params: SaveVacancyParams): number {
    const positionName = this.getPositionName(params.positionId);
    const result = this.database
      .prepare(
        `INSERT INTO vacancies (
           position_id, title, status, employment_type, openings_count
         ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        params.positionId,
        positionName,
        params.status,
        params.employmentType,
        params.openingsCount,
      );
    return Number(result.lastInsertRowid);
  }

  private updateVacancy(params: SaveVacancyParams): number {
    const id = params.id!;
    const hiredCount = Number(
      this.database
        .prepare(
          "SELECT COUNT(*) FROM candidates WHERE vacancy_id = ? AND employee_id IS NOT NULL",
        )
        .pluck()
        .get(id) ?? 0,
    );
    if (params.openingsCount < hiredCount) {
      throw new Error(
        `Количество мест не может быть меньше уже принятых сотрудников (${hiredCount})`,
      );
    }
    const positionName = this.getPositionName(params.positionId);
    const result = this.database
      .prepare(
        `UPDATE vacancies
         SET position_id = ?, title = ?, status = ?, employment_type = ?,
             openings_count = ?, description = NULL, requirements = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(
        params.positionId,
        positionName,
        params.status,
        params.employmentType,
        params.openingsCount,
        id,
      );
    if (result.changes === 0) throw new Error("Вакансия не найдена");
    return id;
  }

  private getPositionName(positionId: number): string {
    const name = this.database
      .prepare("SELECT name FROM positions WHERE id = ?")
      .pluck()
      .get(positionId) as string | undefined;
    if (!name) throw new Error("Выбранная должность не найдена");
    return name;
  }

  private syncVacancySkills(
    vacancyId: number,
    skills: SaveVacancyParams["skills"],
  ): void {
    const existing = this.database
      .prepare("SELECT id FROM vacancy_skills WHERE vacancy_id = ?")
      .all(vacancyId) as Array<{ id: number }>;
    const existingIds = new Set(existing.map((item) => item.id));
    const retainedIds = new Set(
      skills.flatMap((item) => (item.id ? [item.id] : [])),
    );

    retainedIds.forEach((id) => {
      if (!existingIds.has(id)) {
        throw new Error("Один из навыков не принадлежит редактируемой вакансии");
      }
    });

    existing.forEach(({ id }) => {
      if (!retainedIds.has(id)) {
        this.database.prepare("DELETE FROM vacancy_skills WHERE id = ?").run(id);
      }
    });

    const updateSkill = this.database.prepare(
      `UPDATE vacancy_skills
       SET skill_type = ?, name = ?, required_level = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND vacancy_id = ?`,
    );
    const insertSkill = this.database.prepare(
      `INSERT INTO vacancy_skills (
         vacancy_id, skill_type, name, required_level
       ) VALUES (?, ?, ?, ?)`,
    );

    retainedIds.forEach((id) => {
      this.database
        .prepare(
          `UPDATE vacancy_skills
           SET name = '__skill_update_' || id
           WHERE id = ? AND vacancy_id = ?`,
        )
        .run(id, vacancyId);
    });

    skills.forEach((skill) => {
      const values = [
        skill.type,
        skill.name.trim(),
        skill.requiredLevel,
      ] as const;
      if (skill.id) {
        updateSkill.run(...values, skill.id, vacancyId);
      } else {
        insertSkill.run(vacancyId, ...values);
      }
    });
  }

  private insertCandidate(params: SaveCandidateParams): number {
    const result = this.database
      .prepare(
        `INSERT INTO candidates (
           vacancy_id, last_name, first_name, middle_name,
           birth_date, gender, phone, email,
           address_country, address_city, address_street,
           address_house, address_apartment, address,
           source
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.vacancyId,
        params.lastName.trim(),
        params.firstName.trim(),
        nullableText(params.middleName),
        nullableText(params.birthDate),
        nullableText(params.gender),
        nullableText(params.phone),
        nullableText(params.email)?.toLowerCase() ?? null,
        nullableText(params.addressCountry),
        nullableText(params.addressCity),
        nullableText(params.addressStreet),
        nullableText(params.addressHouse),
        nullableText(params.addressApartment),
        nullableText(params.address),
        nullableText(params.source),
      );
    return Number(result.lastInsertRowid);
  }

  private updateCandidate(params: SaveCandidateParams): number {
    const id = params.id!;
    const result = this.database
      .prepare(
        `UPDATE candidates
         SET last_name = ?, first_name = ?, middle_name = ?,
             birth_date = ?, gender = ?, phone = ?, email = ?,
             address_country = ?, address_city = ?, address_street = ?,
             address_house = ?, address_apartment = ?, address = ?,
             source = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(
        params.lastName.trim(),
        params.firstName.trim(),
        nullableText(params.middleName),
        nullableText(params.birthDate),
        nullableText(params.gender),
        nullableText(params.phone),
        nullableText(params.email)?.toLowerCase() ?? null,
        nullableText(params.addressCountry),
        nullableText(params.addressCity),
        nullableText(params.addressStreet),
        nullableText(params.addressHouse),
        nullableText(params.addressApartment),
        nullableText(params.address),
        nullableText(params.source),
        id,
      );
    if (result.changes === 0) throw new Error("Кандидат не найден");
    return id;
  }

  private updateLatestStatusReason(candidateId: number, reason: string): void {
    this.database
      .prepare(
        `UPDATE candidate_status_history
         SET reason = ?
         WHERE id = (
           SELECT id
           FROM candidate_status_history
           WHERE candidate_id = ?
           ORDER BY id DESC
           LIMIT 1
         )`,
      )
      .run(reason, candidateId);
  }

  private rejectActiveCandidatesForVacancy(
    vacancyId: number,
    reason: string,
  ): void {
    const activeCandidates = this.database
      .prepare(
        `SELECT id
         FROM candidates
         WHERE vacancy_id = ?
           AND employee_id IS NULL
           AND status IN ('new', 'screening', 'interview', 'offer')`,
      )
      .all(vacancyId) as Array<{ id: number }>;

    const reject = this.database.prepare(
      `UPDATE candidates
       SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    );
    activeCandidates.forEach(({ id }) => {
      reject.run(id);
      this.updateLatestStatusReason(id, reason);
    });
  }
}

function nextCandidateStatus(status: string): string | null {
  const transitions: Record<string, string> = {
    new: "screening",
    screening: "interview",
    interview: "offer",
  };
  return transitions[status] ?? null;
}

function candidateStatusName(status: string): string {
  const labels: Record<string, string> = {
    new: "Новый",
    screening: "Первичный отбор",
    interview: "Собеседование",
    offer: "Оффер",
    hired: "Принят на работу",
    rejected: "Отклонён",
  };
  return labels[status] ?? status;
}

function nullableText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}
