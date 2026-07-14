CREATE TABLE vacancies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'paused', 'closed')),
  employment_type TEXT NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'temporary', 'internship')),
  openings_count INTEGER NOT NULL DEFAULT 1 CHECK (openings_count > 0),
  description TEXT,
  requirements TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vacancy_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vacancy_id INTEGER NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  required_level INTEGER NOT NULL DEFAULT 5
    CHECK (required_level BETWEEN 1 AND 10),
  weight INTEGER NOT NULL DEFAULT 3 CHECK (weight BETWEEN 1 AND 5),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (vacancy_id, name)
);

CREATE TABLE candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vacancy_id INTEGER NOT NULL REFERENCES vacancies(id) ON DELETE RESTRICT,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'screening', 'interview', 'offer', 'hired', 'rejected')),
  source TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidate_skill_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  vacancy_skill_id INTEGER NOT NULL REFERENCES vacancy_skills(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 10),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (candidate_id, vacancy_skill_id)
);

CREATE INDEX idx_vacancies_position_id ON vacancies(position_id);
CREATE INDEX idx_vacancies_status ON vacancies(status);
CREATE INDEX idx_vacancy_skills_vacancy_id ON vacancy_skills(vacancy_id);
CREATE INDEX idx_candidates_vacancy_id ON candidates(vacancy_id);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidate_skill_scores_candidate_id
  ON candidate_skill_scores(candidate_id);

CREATE TRIGGER trg_validate_candidate_skill_insert
BEFORE INSERT ON candidate_skill_scores
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM candidates
  JOIN vacancy_skills
    ON vacancy_skills.vacancy_id = candidates.vacancy_id
  WHERE candidates.id = NEW.candidate_id
    AND vacancy_skills.id = NEW.vacancy_skill_id
)
BEGIN
  SELECT RAISE(ABORT, 'Навык не принадлежит вакансии кандидата');
END;

CREATE TRIGGER trg_validate_candidate_skill_update
BEFORE UPDATE OF candidate_id, vacancy_skill_id ON candidate_skill_scores
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM candidates
  JOIN vacancy_skills
    ON vacancy_skills.vacancy_id = candidates.vacancy_id
  WHERE candidates.id = NEW.candidate_id
    AND vacancy_skills.id = NEW.vacancy_skill_id
)
BEGIN
  SELECT RAISE(ABORT, 'Навык не принадлежит вакансии кандидата');
END;
