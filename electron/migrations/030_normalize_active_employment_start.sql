-- Keep legacy creation paths compatible with the canonical lifecycle fields.
-- Any active employee created by older code with hire_date but without the new
-- employment_started_at column is normalized immediately after insertion.
UPDATE employees
SET employment_started_at = hire_date
WHERE lifecycle_status = 'active'
  AND employment_started_at IS NULL;

CREATE TRIGGER IF NOT EXISTS employees_fill_employment_start_after_insert
AFTER INSERT ON employees
WHEN NEW.lifecycle_status = 'active'
  AND NEW.employment_started_at IS NULL
BEGIN
  UPDATE employees
  SET employment_started_at = NEW.hire_date,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
