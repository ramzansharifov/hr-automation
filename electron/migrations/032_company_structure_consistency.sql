-- Align the data model with the installation-level company structure:
-- one HR Automation installation contains multiple enterprises, each enterprise
-- contains departments, and employees may move between enterprises while their
-- historical records preserve the enterprise that owned the event at that time.

-- ---------------------------------------------------------------------------
-- Contact data is not a platform identity. Preserve candidate/employee history
-- and allow the same address to appear in different business records.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS enterprises_email_unique_insert;
DROP TRIGGER IF EXISTS enterprises_email_unique_update;
DROP TRIGGER IF EXISTS departments_email_unique_insert;
DROP TRIGGER IF EXISTS departments_email_unique_update;
DROP TRIGGER IF EXISTS employees_email_unique_insert;
DROP TRIGGER IF EXISTS employees_email_unique_update;
DROP TRIGGER IF EXISTS candidates_email_unique_insert;
DROP TRIGGER IF EXISTS candidates_email_unique_update;
DROP VIEW IF EXISTS email_conflicts;
DROP VIEW IF EXISTS all_registered_emails;

-- Compatibility view retained for older code paths. It intentionally contains no
-- rows because e-mail is no longer a uniqueness key in the HR domain.
CREATE VIEW all_registered_emails AS
SELECT 'employee' AS entity_type,
       id AS entity_id,
       LOWER(TRIM(email)) AS normalized_email
FROM employees
WHERE 0;

-- Duplicate employee e-mails are informational only and never block a write.
CREATE VIEW email_conflicts AS
SELECT LOWER(TRIM(email)) AS normalized_email, COUNT(*) AS usage_count
FROM employees
WHERE email IS NOT NULL AND TRIM(email) <> ''
GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1;

-- ---------------------------------------------------------------------------
-- Employee numbers are enterprise-local identifiers. Two enterprises may both
-- have employee 001, while duplicates inside one enterprise remain forbidden.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS uq_employees_employee_number;
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_enterprise_employee_number
  ON employees(enterprise_id, employee_number COLLATE NOCASE)
  WHERE enterprise_id IS NOT NULL
    AND employee_number IS NOT NULL
    AND TRIM(employee_number) <> '';

-- ---------------------------------------------------------------------------
-- Structural ownership. New business data must always have a concrete parent.
-- Existing legacy rows are preserved so upgrades never invent a fake enterprise.
-- ---------------------------------------------------------------------------
CREATE TRIGGER departments_enterprise_required_insert
BEFORE INSERT ON departments
WHEN NEW.enterprise_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Отдел должен принадлежать предприятию');
END;

CREATE TRIGGER departments_enterprise_required_update
BEFORE UPDATE OF enterprise_id ON departments
WHEN NEW.enterprise_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Отдел должен принадлежать предприятию');
END;

DROP TRIGGER IF EXISTS trg_prevent_occupied_department_move;
DROP TRIGGER IF EXISTS departments_sync_employee_enterprise_after_reparent;
CREATE TRIGGER departments_enterprise_immutable
BEFORE UPDATE OF enterprise_id ON departments
WHEN NEW.enterprise_id IS NOT OLD.enterprise_id
BEGIN
  SELECT RAISE(ABORT, 'Предприятие отдела нельзя менять. Создайте отдел в нужном предприятии');
END;

CREATE TRIGGER positions_department_required_insert
BEFORE INSERT ON positions
WHEN NEW.department_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Должность должна принадлежать отделу');
END;

CREATE TRIGGER positions_department_required_update
BEFORE UPDATE OF department_id ON positions
WHEN NEW.department_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Должность должна принадлежать отделу');
END;

CREATE TRIGGER positions_cross_enterprise_move_guard
BEFORE UPDATE OF department_id ON positions
WHEN NEW.department_id IS NOT OLD.department_id
  AND (
    SELECT enterprise_id FROM departments WHERE id = OLD.department_id
  ) IS NOT (
    SELECT enterprise_id FROM departments WHERE id = NEW.department_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Должность нельзя переносить между предприятиями');
END;

CREATE TRIGGER employees_enterprise_required_insert
BEFORE INSERT ON employees
WHEN NEW.enterprise_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Сотрудник должен принадлежать предприятию');
END;

CREATE TRIGGER employees_enterprise_required_update
BEFORE UPDATE OF enterprise_id ON employees
WHEN NEW.enterprise_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Сотрудник должен принадлежать предприятию');
END;

-- A scoped administrative appointment belongs to the organizational unit where
-- it was granted. A normal personnel transfer must not silently grant admin access
-- in the destination enterprise/department.
CREATE TRIGGER employees_revoke_enterprise_admin_after_transfer
AFTER UPDATE OF enterprise_id ON employees
WHEN NEW.enterprise_id IS NOT OLD.enterprise_id
BEGIN
  DELETE FROM user_roles
  WHERE user_id = (SELECT id FROM users WHERE employee_id = NEW.id)
    AND role_id IN (
      SELECT id FROM roles WHERE system_key = 'enterprise_admin'
    );
END;

CREATE TRIGGER employees_revoke_department_admin_after_transfer
AFTER UPDATE OF department_id ON employees
WHEN NEW.department_id IS NOT OLD.department_id
BEGIN
  DELETE FROM user_roles
  WHERE user_id = (SELECT id FROM users WHERE employee_id = NEW.id)
    AND role_id IN (
      SELECT id FROM roles WHERE system_key = 'department_admin'
    );
END;

-- ---------------------------------------------------------------------------
-- Immutable enterprise snapshots for historical employee records.
-- Authorization still follows the employee's current scope, while these fields
-- answer the historical question "in which enterprise did this happen?".
-- ---------------------------------------------------------------------------
ALTER TABLE employment_history ADD COLUMN previous_enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE SET NULL;
ALTER TABLE employment_history ADD COLUMN new_enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE SET NULL;
ALTER TABLE employment_history ADD COLUMN previous_enterprise_name TEXT;
ALTER TABLE employment_history ADD COLUMN new_enterprise_name TEXT;

UPDATE employment_history
SET previous_enterprise_id = COALESCE(
      (SELECT enterprise_id FROM departments WHERE id = employment_history.previous_department_id),
      CASE WHEN change_type = 'hired' THEN NULL
           ELSE (SELECT enterprise_id FROM employees WHERE id = employment_history.employee_id)
      END
    ),
    new_enterprise_id = COALESCE(
      (SELECT enterprise_id FROM departments WHERE id = employment_history.new_department_id),
      (SELECT enterprise_id FROM employees WHERE id = employment_history.employee_id)
    );

UPDATE employment_history
SET previous_enterprise_name = (
      SELECT name FROM enterprises WHERE id = employment_history.previous_enterprise_id
    ),
    new_enterprise_name = (
      SELECT name FROM enterprises WHERE id = employment_history.new_enterprise_id
    );

CREATE INDEX IF NOT EXISTS idx_employment_history_enterprises
  ON employment_history(previous_enterprise_id, new_enterprise_id, effective_at DESC);

CREATE TRIGGER employment_history_fill_enterprise_snapshot
AFTER INSERT ON employment_history
BEGIN
  UPDATE employment_history
  SET previous_enterprise_id = COALESCE(
        NEW.previous_enterprise_id,
        (SELECT enterprise_id FROM departments WHERE id = NEW.previous_department_id),
        CASE WHEN NEW.change_type = 'hired' THEN NULL
             ELSE (SELECT enterprise_id FROM employees WHERE id = NEW.employee_id)
        END
      ),
      new_enterprise_id = COALESCE(
        NEW.new_enterprise_id,
        (SELECT enterprise_id FROM departments WHERE id = NEW.new_department_id),
        (SELECT enterprise_id FROM employees WHERE id = NEW.employee_id)
      ),
      previous_enterprise_name = COALESCE(
        NEW.previous_enterprise_name,
        (SELECT name FROM enterprises WHERE id = COALESCE(
          NEW.previous_enterprise_id,
          (SELECT enterprise_id FROM departments WHERE id = NEW.previous_department_id),
          CASE WHEN NEW.change_type = 'hired' THEN NULL
               ELSE (SELECT enterprise_id FROM employees WHERE id = NEW.employee_id)
          END
        ))
      ),
      new_enterprise_name = COALESCE(
        NEW.new_enterprise_name,
        (SELECT name FROM enterprises WHERE id = COALESCE(
          NEW.new_enterprise_id,
          (SELECT enterprise_id FROM departments WHERE id = NEW.new_department_id),
          (SELECT enterprise_id FROM employees WHERE id = NEW.employee_id)
        ))
      )
  WHERE id = NEW.id;
END;

ALTER TABLE employee_documents ADD COLUMN enterprise_id_snapshot INTEGER REFERENCES enterprises(id) ON DELETE SET NULL;
ALTER TABLE employee_documents ADD COLUMN enterprise_name_snapshot TEXT;

UPDATE employee_documents
SET enterprise_id_snapshot = (
      SELECT enterprise_id FROM employees WHERE id = employee_documents.employee_id
    );
UPDATE employee_documents
SET enterprise_name_snapshot = (
      SELECT name FROM enterprises WHERE id = employee_documents.enterprise_id_snapshot
    );

CREATE INDEX IF NOT EXISTS idx_employee_documents_enterprise_snapshot
  ON employee_documents(enterprise_id_snapshot, created_at DESC);

CREATE TRIGGER employee_documents_fill_enterprise_snapshot
AFTER INSERT ON employee_documents
BEGIN
  UPDATE employee_documents
  SET enterprise_id_snapshot = COALESCE(
        NEW.enterprise_id_snapshot,
        (SELECT enterprise_id FROM employees WHERE id = NEW.employee_id)
      ),
      enterprise_name_snapshot = COALESCE(
        NEW.enterprise_name_snapshot,
        (SELECT enterprise.name
         FROM employees AS employee
         JOIN enterprises AS enterprise ON enterprise.id = employee.enterprise_id
         WHERE employee.id = NEW.employee_id)
      )
  WHERE id = NEW.id;
END;

ALTER TABLE vacations ADD COLUMN enterprise_id_snapshot INTEGER REFERENCES enterprises(id) ON DELETE SET NULL;
ALTER TABLE vacations ADD COLUMN enterprise_name_snapshot TEXT;

UPDATE vacations
SET enterprise_id_snapshot = (
      SELECT enterprise_id FROM employees WHERE id = vacations.employee_id
    );
UPDATE vacations
SET enterprise_name_snapshot = (
      SELECT name FROM enterprises WHERE id = vacations.enterprise_id_snapshot
    );

CREATE INDEX IF NOT EXISTS idx_vacations_enterprise_snapshot
  ON vacations(enterprise_id_snapshot, starts_at DESC);

CREATE TRIGGER vacations_fill_enterprise_snapshot
AFTER INSERT ON vacations
BEGIN
  UPDATE vacations
  SET enterprise_id_snapshot = COALESCE(
        NEW.enterprise_id_snapshot,
        (SELECT enterprise_id FROM employees WHERE id = NEW.employee_id)
      ),
      enterprise_name_snapshot = COALESCE(
        NEW.enterprise_name_snapshot,
        (SELECT enterprise.name
         FROM employees AS employee
         JOIN enterprises AS enterprise ON enterprise.id = employee.enterprise_id
         WHERE employee.id = NEW.employee_id)
      )
  WHERE id = NEW.id;
END;

-- ---------------------------------------------------------------------------
-- Remove the abandoned leave-balance / production-calendar capability. Vacation
-- planning and approval remain in the vacations domain.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions
  WHERE code IN ('leave.view', 'leave.manage', 'leave.calendar_manage')
);
DELETE FROM permissions
WHERE code IN ('leave.view', 'leave.manage', 'leave.calendar_manage');

CREATE TRIGGER role_permissions_system_insert_guard
BEFORE INSERT ON role_permissions
WHEN EXISTS (SELECT 1 FROM roles WHERE id = NEW.role_id AND is_system = 1)
BEGIN
  SELECT RAISE(ABORT, 'Разрешения системной роли нельзя изменять');
END;

CREATE TRIGGER role_permissions_system_delete_guard
BEFORE DELETE ON role_permissions
WHEN EXISTS (SELECT 1 FROM roles WHERE id = OLD.role_id AND is_system = 1)
BEGIN
  SELECT RAISE(ABORT, 'Разрешения системной роли нельзя изменять');
END;

DROP TABLE IF EXISTS leave_balances;
DROP TABLE IF EXISTS work_calendar_days;
ALTER TABLE vacations DROP COLUMN working_days_count;
ALTER TABLE vacations DROP COLUMN entitlement_year;
