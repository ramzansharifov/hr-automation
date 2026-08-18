-- HR Automation keeps personnel data and кадровые salary conditions only.
-- Payroll accruals, payment calculations and accounting-only compensation fields
-- are deliberately removed from the HR domain.

DROP TRIGGER IF EXISTS trg_validate_vacation_insert;
DROP TRIGGER IF EXISTS trg_validate_vacation_update;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id
  FROM permissions
  WHERE code IN ('payroll.view', 'payroll.manage')
);

DELETE FROM permissions
WHERE code IN ('payroll.view', 'payroll.manage');

CREATE TRIGGER role_permissions_system_delete_guard
BEFORE DELETE ON role_permissions
WHEN EXISTS (
  SELECT 1 FROM roles WHERE id = OLD.role_id AND is_system = 1
)
BEGIN
  SELECT RAISE(ABORT, 'Разрешения системной роли нельзя изменять');
END;

DROP TABLE IF EXISTS payroll;

ALTER TABLE positions DROP COLUMN allowance;
ALTER TABLE positions DROP COLUMN bonus;
ALTER TABLE vacations DROP COLUMN payment_amount;

CREATE TRIGGER trg_validate_vacation_insert
BEFORE INSERT ON vacations
BEGIN
  SELECT CASE WHEN NEW.ends_at < NEW.starts_at
    THEN RAISE(ABORT, 'Дата окончания отпуска раньше даты начала') END;
  SELECT CASE WHEN NEW.days_count != CAST(julianday(NEW.ends_at) - julianday(NEW.starts_at) + 1 AS INTEGER)
    THEN RAISE(ABORT, 'Количество дней отпуска рассчитано неверно') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM vacations
    WHERE employee_id = NEW.employee_id
      AND status IN ('planned', 'approved')
      AND NEW.status IN ('planned', 'approved')
      AND starts_at <= NEW.ends_at AND ends_at >= NEW.starts_at
  ) THEN RAISE(ABORT, 'Период отпуска пересекается с существующим') END;
END;

CREATE TRIGGER trg_validate_vacation_update
BEFORE UPDATE ON vacations
BEGIN
  SELECT CASE WHEN NEW.ends_at < NEW.starts_at
    THEN RAISE(ABORT, 'Дата окончания отпуска раньше даты начала') END;
  SELECT CASE WHEN NEW.days_count != CAST(julianday(NEW.ends_at) - julianday(NEW.starts_at) + 1 AS INTEGER)
    THEN RAISE(ABORT, 'Количество дней отпуска рассчитано неверно') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM vacations
    WHERE id != NEW.id AND employee_id = NEW.employee_id
      AND status IN ('planned', 'approved')
      AND NEW.status IN ('planned', 'approved')
      AND starts_at <= NEW.ends_at AND ends_at >= NEW.starts_at
  ) THEN RAISE(ABORT, 'Период отпуска пересекается с существующим') END;
END;
