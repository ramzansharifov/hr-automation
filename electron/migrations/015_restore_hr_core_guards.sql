CREATE TRIGGER roles_system_update_guard
BEFORE UPDATE ON roles
WHEN OLD.is_system = 1
BEGIN
  SELECT RAISE(ABORT, 'Системную роль нельзя изменять');
END;

CREATE TRIGGER trg_validate_employee_assignment_insert
BEFORE INSERT ON employees
WHEN NEW.position_id IS NOT NULL AND (
  SELECT department_id FROM positions WHERE id = NEW.position_id
) IS NOT NEW.department_id
BEGIN
  SELECT RAISE(ABORT, 'Должность не принадлежит выбранному отделу');
END;

CREATE TRIGGER trg_validate_employee_assignment_update
BEFORE UPDATE OF department_id, position_id ON employees
WHEN NEW.position_id IS NOT NULL AND (
  SELECT department_id FROM positions WHERE id = NEW.position_id
) IS NOT NEW.department_id
BEGIN
  SELECT RAISE(ABORT, 'Должность не принадлежит выбранному отделу');
END;

CREATE TRIGGER trg_protect_employee_leadership_assignment
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

CREATE TRIGGER trg_validate_enterprise_director_update
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
  SELECT RAISE(ABORT, 'Руководитель предприятия должен быть активным сотрудником этого предприятия без другой руководящей роли');
END;

CREATE TRIGGER trg_prevent_occupied_enterprise_delete
BEFORE DELETE ON enterprises
WHEN EXISTS (SELECT 1 FROM departments WHERE enterprise_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя удалить предприятие, в котором есть отделы');
END;
