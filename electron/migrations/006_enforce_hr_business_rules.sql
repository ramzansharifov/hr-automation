CREATE TABLE IF NOT EXISTS organization_assignment_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  conflict_reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

INSERT INTO organization_assignment_conflicts (employee_id, entity_type, entity_id, conflict_reason)
SELECT general_director_employee_id, 'enterprise', id, 'Повторное назначение генеральным директором'
FROM enterprises
WHERE general_director_employee_id IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id) FROM enterprises
    WHERE general_director_employee_id IS NOT NULL
    GROUP BY general_director_employee_id
  );

UPDATE enterprises
SET general_director_employee_id = NULL
WHERE general_director_employee_id IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id) FROM enterprises
    WHERE general_director_employee_id IS NOT NULL
    GROUP BY general_director_employee_id
  );

INSERT INTO organization_assignment_conflicts (employee_id, entity_type, entity_id, conflict_reason)
SELECT director_employee_id, 'department', id, 'Повторное назначение директором отдела'
FROM departments
WHERE director_employee_id IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id) FROM departments
    WHERE director_employee_id IS NOT NULL
    GROUP BY director_employee_id
  );

UPDATE departments
SET director_employee_id = NULL
WHERE director_employee_id IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id) FROM departments
    WHERE director_employee_id IS NOT NULL
    GROUP BY director_employee_id
  );

INSERT INTO organization_assignment_conflicts (employee_id, entity_type, entity_id, conflict_reason)
SELECT departments.director_employee_id, 'department', departments.id,
       'Сотрудник уже назначен генеральным директором предприятия'
FROM departments
WHERE departments.director_employee_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM enterprises
    WHERE enterprises.general_director_employee_id = departments.director_employee_id
  );

UPDATE departments
SET director_employee_id = NULL
WHERE director_employee_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM enterprises
    WHERE enterprises.general_director_employee_id = departments.director_employee_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_enterprises_general_director
  ON enterprises(general_director_employee_id)
  WHERE general_director_employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_director
  ON departments(director_employee_id)
  WHERE director_employee_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_validate_employee_assignment_insert
BEFORE INSERT ON employees
WHEN NEW.position_id IS NOT NULL AND (
  SELECT department_id FROM positions WHERE id = NEW.position_id
) IS NOT NEW.department_id
BEGIN
  SELECT RAISE(ABORT, 'Должность не принадлежит выбранному отделу');
END;

CREATE TRIGGER IF NOT EXISTS trg_validate_employee_assignment_update
BEFORE UPDATE OF department_id, position_id ON employees
WHEN NEW.position_id IS NOT NULL AND (
  SELECT department_id FROM positions WHERE id = NEW.position_id
) IS NOT NEW.department_id
BEGIN
  SELECT RAISE(ABORT, 'Должность не принадлежит выбранному отделу');
END;

CREATE TRIGGER IF NOT EXISTS trg_protect_employee_leadership_assignment
BEFORE UPDATE OF department_id, status ON employees
WHEN (
  NEW.status != 'active' AND (
    EXISTS (SELECT 1 FROM enterprises WHERE general_director_employee_id = OLD.id)
    OR EXISTS (SELECT 1 FROM departments WHERE director_employee_id = OLD.id)
  )
) OR EXISTS (
  SELECT 1 FROM departments
  WHERE director_employee_id = OLD.id AND id IS NOT NEW.department_id
) OR EXISTS (
  SELECT 1 FROM enterprises
  WHERE general_director_employee_id = OLD.id
    AND id IS NOT (
      SELECT enterprise_id FROM departments WHERE id = NEW.department_id
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Сначала снимите сотрудника с руководящей роли');
END;

CREATE TRIGGER IF NOT EXISTS trg_validate_enterprise_director_insert
BEFORE INSERT ON enterprises
WHEN NEW.general_director_employee_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM employees
  WHERE id = NEW.general_director_employee_id AND status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'Генеральным директором может быть только активный сотрудник');
END;

CREATE TRIGGER IF NOT EXISTS trg_validate_enterprise_director_update
BEFORE UPDATE OF general_director_employee_id ON enterprises
WHEN NEW.general_director_employee_id IS NOT NULL AND (
  NOT EXISTS (
    SELECT 1 FROM employees
    JOIN departments ON departments.id = employees.department_id
    WHERE employees.id = NEW.general_director_employee_id
      AND employees.status = 'active'
      AND departments.enterprise_id = NEW.id
  ) OR EXISTS (
    SELECT 1 FROM departments
    WHERE director_employee_id = NEW.general_director_employee_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'Генеральный директор должен быть активным сотрудником этого предприятия без другой руководящей роли');
END;

CREATE TRIGGER IF NOT EXISTS trg_validate_department_director_insert
AFTER INSERT ON departments
WHEN NEW.director_employee_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM employees
  WHERE id = NEW.director_employee_id AND status = 'active' AND department_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'Директор отдела должен быть активным сотрудником этого отдела');
END;

CREATE TRIGGER IF NOT EXISTS trg_validate_department_director_update
BEFORE UPDATE OF director_employee_id ON departments
WHEN NEW.director_employee_id IS NOT NULL AND (
  NOT EXISTS (
    SELECT 1 FROM employees
    WHERE id = NEW.director_employee_id AND status = 'active' AND department_id = NEW.id
  ) OR EXISTS (
    SELECT 1 FROM enterprises
    WHERE general_director_employee_id = NEW.director_employee_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'Директор отдела должен быть активным сотрудником этого отдела без другой руководящей роли');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_occupied_position_delete
BEFORE DELETE ON positions
WHEN EXISTS (SELECT 1 FROM employees WHERE position_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя удалить должность, на которую назначены сотрудники');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_occupied_position_move
BEFORE UPDATE OF department_id ON positions
WHEN OLD.department_id IS NOT NEW.department_id
  AND EXISTS (SELECT 1 FROM employees WHERE position_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя перенести должность, на которую назначены сотрудники');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_occupied_department_delete
BEFORE DELETE ON departments
WHEN EXISTS (SELECT 1 FROM employees WHERE department_id = OLD.id)
  OR EXISTS (SELECT 1 FROM positions WHERE department_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя удалить отдел с сотрудниками или должностями');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_occupied_department_move
BEFORE UPDATE OF enterprise_id ON departments
WHEN OLD.enterprise_id IS NOT NEW.enterprise_id AND (
  EXISTS (SELECT 1 FROM employees WHERE department_id = OLD.id)
  OR EXISTS (SELECT 1 FROM positions WHERE department_id = OLD.id)
)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя перенести непустой отдел в другое предприятие');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_occupied_enterprise_delete
BEFORE DELETE ON enterprises
WHEN EXISTS (SELECT 1 FROM departments WHERE enterprise_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя удалить предприятие, в котором есть отделы');
END;

CREATE TRIGGER IF NOT EXISTS trg_validate_vacation_insert
BEFORE INSERT ON vacations
BEGIN
  SELECT CASE WHEN NEW.ends_at < NEW.starts_at
    THEN RAISE(ABORT, 'Дата окончания отпуска раньше даты начала') END;
  SELECT CASE WHEN NEW.days_count != CAST(julianday(NEW.ends_at) - julianday(NEW.starts_at) + 1 AS INTEGER)
    THEN RAISE(ABORT, 'Количество дней отпуска рассчитано неверно') END;
  SELECT CASE WHEN NEW.is_paid = 0 AND NEW.payment_amount != 0
    THEN RAISE(ABORT, 'У неоплачиваемого отпуска не может быть отпускных') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM vacations
    WHERE employee_id = NEW.employee_id
      AND status IN ('planned', 'approved')
      AND NEW.status IN ('planned', 'approved')
      AND starts_at <= NEW.ends_at AND ends_at >= NEW.starts_at
  ) THEN RAISE(ABORT, 'Период отпуска пересекается с существующим') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_validate_vacation_update
BEFORE UPDATE ON vacations
BEGIN
  SELECT CASE WHEN NEW.ends_at < NEW.starts_at
    THEN RAISE(ABORT, 'Дата окончания отпуска раньше даты начала') END;
  SELECT CASE WHEN NEW.days_count != CAST(julianday(NEW.ends_at) - julianday(NEW.starts_at) + 1 AS INTEGER)
    THEN RAISE(ABORT, 'Количество дней отпуска рассчитано неверно') END;
  SELECT CASE WHEN NEW.is_paid = 0 AND NEW.payment_amount != 0
    THEN RAISE(ABORT, 'У неоплачиваемого отпуска не может быть отпускных') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM vacations
    WHERE id != NEW.id AND employee_id = NEW.employee_id
      AND status IN ('planned', 'approved')
      AND NEW.status IN ('planned', 'approved')
      AND starts_at <= NEW.ends_at AND ends_at >= NEW.starts_at
  ) THEN RAISE(ABORT, 'Период отпуска пересекается с существующим') END;
END;
