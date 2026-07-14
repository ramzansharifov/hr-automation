import type Database from "better-sqlite3";

import type {
  CandidateProfile,
  RecruitmentListParams,
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
           vacancies.note,
           vacancies.created_at,
           vacancies.updated_at,
           positions.name AS position_name,
           departments.name AS department_name,
           enterprises.name AS enterprise_name,
           COUNT(DISTINCT vacancy_skills.id) AS skills_count,
           COUNT(DISTINCT CASE
             WHEN vacancy_skills.skill_type = 'hard' THEN vacancy_skills.id
           END) AS hard_skills_count,
           COUNT(DISTINCT CASE
             WHEN vacancy_skills.skill_type = 'soft' THEN vacancy_skills.id
           END) AS soft_skills_count,
           COUNT(DISTINCT candidates.id) AS candidates_count,
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
         WHERE @search = ''
           OR positions.name LIKE @pattern
           OR departments.name LIKE @pattern
           OR enterprises.name LIKE @pattern
           OR EXISTS (
             SELECT 1
             FROM vacancy_skills AS searched_skill
             WHERE searched_skill.vacancy_id = vacancies.id
               AND searched_skill.name LIKE @pattern
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
           vacancies.note,
           vacancies.created_at,
           vacancies.updated_at,
           positions.name AS position_name,
           departments.name AS department_name,
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
           weight DESC,
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
      return vacancyId;
    });

    const vacancyId = save();
    const profile = this.getVacancy(vacancyId);
    if (!profile) throw new Error("Сохранённая вакансия не найдена");
    return profile;
  }

  deleteVacancy(id: number): void {
    const candidatesCount = this.database
      .prepare("SELECT COUNT(*) FROM candidates WHERE vacancy_id = ?")
      .pluck()
      .get(id) as number;

    if (candidatesCount > 0) {
      throw new Error(
        "Нельзя удалить вакансию с кандидатами. Сначала удалите или перенесите кандидатов",
      );
    }

    this.database.prepare("DELETE FROM vacancies WHERE id = ?").run(id);
  }

  listCandidates(params: RecruitmentListParams): HrRecord[] {
    const search = params.search?.trim() ?? "";
    return this.database
      .prepare(
        `SELECT
           candidates.*,
           departments.name AS vacancy_title,
           positions.name AS position_name,
           departments.name AS department_name,
           COALESCE(
             (SELECT ROUND(
               100.0 * SUM(
                 MIN(
                   CAST(COALESCE(candidate_score.score, 0) AS REAL) /
                     vacancy_skill.required_level,
                   1.0
                 ) * vacancy_skill.weight
               ) / NULLIF(SUM(vacancy_skill.weight), 0),
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
         WHERE @search = ''
           OR candidates.last_name LIKE @pattern
           OR candidates.first_name LIKE @pattern
           OR candidates.middle_name LIKE @pattern
           OR candidates.phone LIKE @pattern
           OR candidates.email LIKE @pattern
           OR positions.name LIKE @pattern
         ORDER BY match_percentage DESC, candidates.updated_at DESC, candidates.id DESC`,
      )
      .all({ search, pattern: `%${search}%` }) as HrRecord[];
  }

  getCandidate(id: number): CandidateProfile | null {
    const candidate = this.database
      .prepare(
        `SELECT
           candidates.*,
           departments.name AS vacancy_title,
           positions.name AS position_name
         FROM candidates
         JOIN vacancies ON vacancies.id = candidates.vacancy_id
         JOIN positions ON positions.id = vacancies.position_id
         LEFT JOIN departments ON departments.id = positions.department_id
         WHERE candidates.id = ?
         LIMIT 1`,
      )
      .get(id) as HrRecord | undefined;

    if (!candidate) return null;

    const vacancyId = Number(candidate.vacancy_id);
    const vacancySkills = this.database
      .prepare(
        `SELECT *
         FROM vacancy_skills
         WHERE vacancy_id = ?
         ORDER BY
           CASE skill_type WHEN 'hard' THEN 1 ELSE 2 END,
           weight DESC,
           required_level DESC,
           name ASC`,
      )
      .all(vacancyId) as HrRecord[];
    const skillScores = this.database
      .prepare(
        `SELECT *
         FROM candidate_skill_scores
         WHERE candidate_id = ?`,
      )
      .all(id) as HrRecord[];

    return { candidate, vacancySkills, skillScores };
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
           candidate_id, vacancy_skill_id, score, note
         ) VALUES (?, ?, ?, ?)`,
      );
      params.skillScores.forEach((item) => {
        insertScore.run(
          candidateId,
          item.vacancySkillId,
          item.score,
          item.note?.trim() || null,
        );
      });

      return candidateId;
    });

    const candidateId = save();
    const profile = this.getCandidate(candidateId);
    if (!profile) throw new Error("Сохранённый кандидат не найден");
    return profile;
  }

  deleteCandidate(id: number): void {
    this.database.prepare("DELETE FROM candidates WHERE id = ?").run(id);
  }

  private insertVacancy(params: SaveVacancyParams): number {
    const positionName = this.getPositionName(params.positionId);
    const result = this.database
      .prepare(
        `INSERT INTO vacancies (
           position_id, title, status, employment_type, openings_count, note
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.positionId,
        positionName,
        params.status,
        params.employmentType,
        params.openingsCount,
        params.note?.trim() || null,
      );
    return Number(result.lastInsertRowid);
  }

  private updateVacancy(params: SaveVacancyParams): number {
    const id = params.id!;
    const positionName = this.getPositionName(params.positionId);
    const result = this.database
      .prepare(
        `UPDATE vacancies
         SET position_id = ?, title = ?, status = ?, employment_type = ?,
             openings_count = ?, description = NULL, requirements = NULL,
             note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(
        params.positionId,
        positionName,
        params.status,
        params.employmentType,
        params.openingsCount,
        params.note?.trim() || null,
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
       SET skill_type = ?, name = ?, required_level = ?, weight = ?, note = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND vacancy_id = ?`,
    );
    const insertSkill = this.database.prepare(
      `INSERT INTO vacancy_skills (
         vacancy_id, skill_type, name, required_level, weight, note
       ) VALUES (?, ?, ?, ?, ?, ?)`,
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
        skill.weight,
        skill.note?.trim() || null,
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
           vacancy_id, last_name, first_name, middle_name, phone, email,
           status, source, note
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.vacancyId,
        params.lastName.trim(),
        params.firstName.trim(),
        params.middleName?.trim() || null,
        params.phone?.trim() || null,
        params.email?.trim() || null,
        params.status,
        params.source?.trim() || null,
        params.note?.trim() || null,
      );
    return Number(result.lastInsertRowid);
  }

  private updateCandidate(params: SaveCandidateParams): number {
    const id = params.id!;
    const result = this.database
      .prepare(
        `UPDATE candidates
         SET vacancy_id = ?, last_name = ?, first_name = ?, middle_name = ?,
             phone = ?, email = ?, status = ?, source = ?, note = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(
        params.vacancyId,
        params.lastName.trim(),
        params.firstName.trim(),
        params.middleName?.trim() || null,
        params.phone?.trim() || null,
        params.email?.trim() || null,
        params.status,
        params.source?.trim() || null,
        params.note?.trim() || null,
        id,
      );
    if (result.changes === 0) throw new Error("Кандидат не найден");
    return id;
  }
}
