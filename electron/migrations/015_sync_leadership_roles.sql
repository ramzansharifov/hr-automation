DROP TRIGGER IF EXISTS roles_system_update_guard;

UPDATE roles
SET name = 'Руководитель предприятия',
    description = 'Просмотр данных сотрудников и процессов своего предприятия.'
WHERE system_key = 'enterprise_director';

UPDATE roles
SET name = 'Руководитель отдела',
    description = 'Просмотр сотрудников и процессов своего отдела.'
WHERE system_key = 'department_head';

CREATE TRIGGER roles_system_update_guard
BEFORE UPDATE ON roles
WHEN OLD.is_system = 1
BEGIN
  SELECT RAISE(ABORT, 'Системную роль нельзя изменять');
END;

CREATE TRIGGER enterprises_grant_director_access
AFTER UPDATE OF general_director_employee_id ON enterprises
WHEN NEW.general_director_employee_id IS NOT NULL
  AND OLD.general_director_employee_id IS NOT NEW.general_director_employee_id
BEGIN
  INSERT OR IGNORE INTO user_roles (user_id, role_id)
  SELECT user.id, role.id
  FROM users AS user
  JOIN roles AS role ON role.system_key = 'enterprise_director'
  WHERE user.employee_id = NEW.general_director_employee_id;
END;

CREATE TRIGGER departments_grant_head_access
AFTER UPDATE OF director_employee_id ON departments
WHEN NEW.director_employee_id IS NOT NULL
  AND OLD.director_employee_id IS NOT NEW.director_employee_id
BEGIN
  INSERT OR IGNORE INTO user_roles (user_id, role_id)
  SELECT user.id, role.id
  FROM users AS user
  JOIN roles AS role ON role.system_key = 'department_head'
  WHERE user.employee_id = NEW.director_employee_id;
END;
