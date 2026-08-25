-- Cross-cutting invariants for the expanded HR core.

-- Keep registration timestamp populated for every new employee without requiring
-- every insertion path (candidate hire, import, manual creation) to know about it.
CREATE TRIGGER employees_fill_registered_at
AFTER INSERT ON employees
WHEN NEW.registered_at IS NULL
BEGIN
  UPDATE employees SET registered_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- A pending employee must not accidentally be treated as employed by legacy code.
CREATE TRIGGER employees_lifecycle_sync_status
AFTER UPDATE OF lifecycle_status ON employees
WHEN NEW.lifecycle_status IS NOT OLD.lifecycle_status
  AND NEW.status IS NOT NEW.lifecycle_status
BEGIN
  UPDATE employees SET status = NEW.lifecycle_status WHERE id = NEW.id;
END;

-- No employee may have overlapping leave records that are still operational.
CREATE TRIGGER vacations_overlap_guard_insert
BEFORE INSERT ON vacations
WHEN NEW.status IN ('planned', 'approved', 'completed')
  AND EXISTS (
    SELECT 1 FROM vacations AS existing
    WHERE existing.employee_id = NEW.employee_id
      AND existing.status IN ('planned', 'approved', 'completed')
      AND NEW.starts_at <= existing.ends_at
      AND NEW.ends_at >= existing.starts_at
  )
BEGIN
  SELECT RAISE(ABORT, 'Период отпуска пересекается с другой записью сотрудника');
END;

CREATE TRIGGER vacations_overlap_guard_update
BEFORE UPDATE OF employee_id, starts_at, ends_at, status ON vacations
WHEN NEW.status IN ('planned', 'approved', 'completed')
  AND EXISTS (
    SELECT 1 FROM vacations AS existing
    WHERE existing.employee_id = NEW.employee_id
      AND existing.id <> NEW.id
      AND existing.status IN ('planned', 'approved', 'completed')
      AND NEW.starts_at <= existing.ends_at
      AND NEW.ends_at >= existing.starts_at
  )
BEGIN
  SELECT RAISE(ABORT, 'Период отпуска пересекается с другой записью сотрудника');
END;

-- Archived organization objects cannot be silently reactivated by ordinary CRUD.
-- Reactivation, if ever needed, should become an explicit lifecycle operation.
CREATE TRIGGER enterprises_archive_monotonic_guard
BEFORE UPDATE OF is_archived ON enterprises
WHEN OLD.is_archived = 1 AND NEW.is_archived = 0
BEGIN
  SELECT RAISE(ABORT, 'Архивное предприятие нельзя восстановить обычным редактированием');
END;

CREATE TRIGGER departments_archive_monotonic_guard
BEFORE UPDATE OF is_archived ON departments
WHEN OLD.is_archived = 1 AND NEW.is_archived = 0
BEGIN
  SELECT RAISE(ABORT, 'Архивный отдел нельзя восстановить обычным редактированием');
END;

CREATE TRIGGER positions_archive_monotonic_guard
BEFORE UPDATE OF is_archived ON positions
WHEN OLD.is_archived = 1 AND NEW.is_archived = 0
BEGIN
  SELECT RAISE(ABORT, 'Архивную должность нельзя восстановить обычным редактированием');
END;
