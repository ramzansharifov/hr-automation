-- Candidate lifecycle is a controlled recruitment workflow.
-- Status changes are business actions, not editable form values.

ALTER TABLE candidates ADD COLUMN birth_date TEXT;
ALTER TABLE candidates ADD COLUMN gender TEXT;
ALTER TABLE candidates ADD COLUMN address_country TEXT;
ALTER TABLE candidates ADD COLUMN address_city TEXT;
ALTER TABLE candidates ADD COLUMN address_street TEXT;
ALTER TABLE candidates ADD COLUMN address_house TEXT;
ALTER TABLE candidates ADD COLUMN address_apartment TEXT;
ALTER TABLE candidates ADD COLUMN address TEXT;

-- Older installations already received an initial history row in migration 014.
-- Repair only records that somehow have no history.
INSERT INTO candidate_status_history (
  candidate_id, previous_status, new_status, reason
)
SELECT candidates.id, NULL, candidates.status, 'Кандидат зарегистрирован'
FROM candidates
WHERE NOT EXISTS (
  SELECT 1
  FROM candidate_status_history
  WHERE candidate_status_history.candidate_id = candidates.id
);

DROP TRIGGER IF EXISTS candidates_initial_status_history;
CREATE TRIGGER candidates_initial_status_history
AFTER INSERT ON candidates
BEGIN
  INSERT INTO candidate_status_history (
    candidate_id, previous_status, new_status, reason
  ) VALUES (
    NEW.id, NULL, NEW.status, 'Кандидат зарегистрирован'
  );
END;

DROP TRIGGER IF EXISTS candidates_status_transition_guard;
CREATE TRIGGER candidates_status_transition_guard
BEFORE UPDATE OF status ON candidates
WHEN OLD.status IS NOT NEW.status
  AND NOT (
    (OLD.status = 'new' AND NEW.status IN ('screening', 'rejected'))
    OR (OLD.status = 'screening' AND NEW.status IN ('interview', 'rejected'))
    OR (OLD.status = 'interview' AND NEW.status IN ('offer', 'rejected'))
    OR (OLD.status = 'offer' AND NEW.status IN ('hired', 'rejected'))
  )
BEGIN
  SELECT RAISE(ABORT, 'Недопустимый переход этапа кандидата');
END;

DROP TRIGGER IF EXISTS candidates_status_history;
CREATE TRIGGER candidates_status_history
AFTER UPDATE OF status ON candidates
WHEN OLD.status IS NOT NEW.status
BEGIN
  INSERT INTO candidate_status_history (
    candidate_id, previous_status, new_status, reason
  ) VALUES (
    NEW.id,
    OLD.status,
    NEW.status,
    CASE
      WHEN NEW.status = 'hired' THEN 'Кандидат принят на работу'
      WHEN NEW.status = 'rejected' THEN 'Кандидат отклонён'
      ELSE 'Переход на следующий этап подбора'
    END
  );
END;

DROP TRIGGER IF EXISTS candidates_vacancy_immutable;
CREATE TRIGGER candidates_vacancy_immutable
BEFORE UPDATE OF vacancy_id ON candidates
WHEN OLD.vacancy_id IS NOT NEW.vacancy_id
BEGIN
  SELECT RAISE(ABORT, 'Вакансию кандидата нельзя изменить после регистрации');
END;

DROP TRIGGER IF EXISTS candidates_open_vacancy_insert_guard;
CREATE TRIGGER candidates_open_vacancy_insert_guard
BEFORE INSERT ON candidates
WHEN NOT EXISTS (
  SELECT 1
  FROM vacancies
  WHERE id = NEW.vacancy_id
    AND status = 'open'
    AND is_archived = 0
)
BEGIN
  SELECT RAISE(ABORT, 'Добавлять кандидатов можно только в открытую вакансию');
END;

DROP TRIGGER IF EXISTS candidates_hire_capacity_guard;
CREATE TRIGGER candidates_hire_capacity_guard
BEFORE UPDATE OF status ON candidates
WHEN OLD.status IS NOT NEW.status
  AND NEW.status = 'hired'
  AND (
    SELECT COUNT(*)
    FROM candidates AS hired_candidate
    WHERE hired_candidate.vacancy_id = NEW.vacancy_id
      AND hired_candidate.id <> OLD.id
      AND hired_candidate.employee_id IS NOT NULL
  ) >= (
    SELECT vacancies.openings_count
    FROM vacancies
    WHERE vacancies.id = NEW.vacancy_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Все места по вакансии уже заполнены');
END;

DROP TRIGGER IF EXISTS candidates_history_delete_guard;
CREATE TRIGGER candidates_history_delete_guard
BEFORE DELETE ON candidates
WHEN OLD.employee_id IS NOT NULL
  OR OLD.status <> 'new'
  OR EXISTS (
    SELECT 1
    FROM candidate_status_history
    WHERE candidate_status_history.candidate_id = OLD.id
      AND previous_status IS NOT NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'Кандидата с историей подбора нельзя удалить');
END;

UPDATE permissions
SET description = 'Изменение данных кандидата, оценок и управление переходами по этапам подбора.'
WHERE code = 'candidates.edit';
