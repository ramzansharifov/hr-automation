-- Preserve recruitment history: vacancies that have ever been used by candidates
-- are archived instead of being physically deleted. Unused erroneous vacancies
-- can still be removed by the normal DELETE operation.
CREATE TRIGGER IF NOT EXISTS vacancies_archive_used_before_delete
BEFORE DELETE ON vacancies
WHEN EXISTS (SELECT 1 FROM candidates WHERE vacancy_id = OLD.id)
BEGIN
  UPDATE vacancies
  SET status = 'closed',
      is_archived = 1,
      archived_at = CURRENT_DATE,
      archive_reason = COALESCE(
        NULLIF(TRIM(archive_reason), ''),
        'Архивировано вместо удаления: вакансия использовалась в подборе'
      ),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.id;

  SELECT RAISE(IGNORE);
END;

-- Archived vacancies are immutable business-history records. They can only be
-- read together with candidate/recruitment history.
CREATE TRIGGER IF NOT EXISTS vacancies_archived_update_guard
BEFORE UPDATE ON vacancies
WHEN OLD.is_archived = 1
  AND (
    NEW.position_id IS NOT OLD.position_id
    OR NEW.employment_type IS NOT OLD.employment_type
    OR NEW.openings_count IS NOT OLD.openings_count
    OR NEW.status IS NOT OLD.status
  )
BEGIN
  SELECT RAISE(ABORT, 'Архивную вакансию нельзя изменять');
END;

CREATE TRIGGER IF NOT EXISTS candidates_archived_vacancy_insert_guard
BEFORE INSERT ON candidates
WHEN EXISTS (
  SELECT 1 FROM vacancies
  WHERE id = NEW.vacancy_id AND is_archived = 1
)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя добавить кандидата в архивную вакансию');
END;

CREATE TRIGGER IF NOT EXISTS candidates_archived_vacancy_update_guard
BEFORE UPDATE OF vacancy_id ON candidates
WHEN EXISTS (
  SELECT 1 FROM vacancies
  WHERE id = NEW.vacancy_id AND is_archived = 1
)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя перенести кандидата в архивную вакансию');
END;
