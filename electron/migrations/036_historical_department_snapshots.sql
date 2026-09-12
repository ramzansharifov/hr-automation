-- Preserve the organizational owner of employee documents and vacations at the
-- moment the record is created. This keeps department-scoped historical data
-- stable after personnel transfers without changing any user-facing workflow.

ALTER TABLE employee_documents
  ADD COLUMN department_id_snapshot INTEGER REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE employee_documents
  ADD COLUMN department_name_snapshot TEXT;

UPDATE employee_documents
SET department_id_snapshot = (
      SELECT department_id FROM employees WHERE id = employee_documents.employee_id
    );

UPDATE employee_documents
SET department_name_snapshot = (
      SELECT name FROM departments WHERE id = employee_documents.department_id_snapshot
    );

CREATE INDEX IF NOT EXISTS idx_employee_documents_department_snapshot
  ON employee_documents(department_id_snapshot, created_at DESC);

DROP TRIGGER IF EXISTS employee_documents_fill_enterprise_snapshot;
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
      ),
      department_id_snapshot = COALESCE(
        NEW.department_id_snapshot,
        (SELECT department_id FROM employees WHERE id = NEW.employee_id)
      ),
      department_name_snapshot = COALESCE(
        NEW.department_name_snapshot,
        (SELECT department.name
         FROM employees AS employee
         JOIN departments AS department ON department.id = employee.department_id
         WHERE employee.id = NEW.employee_id)
      )
  WHERE id = NEW.id;
END;

ALTER TABLE vacations
  ADD COLUMN department_id_snapshot INTEGER REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE vacations
  ADD COLUMN department_name_snapshot TEXT;

UPDATE vacations
SET department_id_snapshot = (
      SELECT department_id FROM employees WHERE id = vacations.employee_id
    );

UPDATE vacations
SET department_name_snapshot = (
      SELECT name FROM departments WHERE id = vacations.department_id_snapshot
    );

CREATE INDEX IF NOT EXISTS idx_vacations_department_snapshot
  ON vacations(department_id_snapshot, starts_at DESC);

DROP TRIGGER IF EXISTS vacations_fill_enterprise_snapshot;
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
      ),
      department_id_snapshot = COALESCE(
        NEW.department_id_snapshot,
        (SELECT department_id FROM employees WHERE id = NEW.employee_id)
      ),
      department_name_snapshot = COALESCE(
        NEW.department_name_snapshot,
        (SELECT department.name
         FROM employees AS employee
         JOIN departments AS department ON department.id = employee.department_id
         WHERE employee.id = NEW.employee_id)
      )
  WHERE id = NEW.id;
END;
