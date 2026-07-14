ALTER TABLE vacancy_skills
ADD COLUMN skill_type TEXT NOT NULL DEFAULT 'hard'
  CHECK (skill_type IN ('hard', 'soft'));

UPDATE vacancy_skills
SET skill_type = 'hard'
WHERE skill_type IS NULL OR skill_type NOT IN ('hard', 'soft');

UPDATE vacancies
SET title = COALESCE(
      (SELECT positions.name FROM positions WHERE positions.id = vacancies.position_id),
      title
    ),
    description = NULL,
    requirements = NULL;

CREATE INDEX idx_vacancy_skills_vacancy_type
  ON vacancy_skills(vacancy_id, skill_type);
