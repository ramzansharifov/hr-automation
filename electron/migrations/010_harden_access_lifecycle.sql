CREATE TRIGGER employees_preserve_last_superadmin
BEFORE UPDATE OF status ON employees
WHEN OLD.status = 'active'
  AND NEW.status <> 'active'
  AND EXISTS (
    SELECT 1
    FROM users AS user
    JOIN user_roles AS user_role ON user_role.user_id = user.id
    JOIN roles AS role ON role.id = user_role.role_id
    WHERE user.employee_id = OLD.id
      AND user.status = 'active'
      AND role.system_key = 'superadmin'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM users AS user
    JOIN employees AS employee ON employee.id = user.employee_id
    JOIN user_roles AS user_role ON user_role.user_id = user.id
    JOIN roles AS role ON role.id = user_role.role_id
    WHERE user.status = 'active'
      AND employee.status = 'active'
      AND employee.id <> OLD.id
      AND role.system_key = 'superadmin'
  )
BEGIN
  SELECT RAISE(ABORT, 'Нельзя деактивировать сотрудника последнего активного superadmin');
END;

CREATE TRIGGER enterprises_revoke_director_access_after_delete
AFTER DELETE ON enterprises
WHEN OLD.general_director_employee_id IS NOT NULL
BEGIN
  DELETE FROM user_roles
  WHERE user_id = (
    SELECT id FROM users WHERE employee_id = OLD.general_director_employee_id
  )
    AND role_id = (
      SELECT id FROM roles WHERE system_key = 'enterprise_director'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM enterprises
      WHERE general_director_employee_id = OLD.general_director_employee_id
    );
END;

CREATE TRIGGER departments_revoke_head_access_after_delete
AFTER DELETE ON departments
WHEN OLD.director_employee_id IS NOT NULL
BEGIN
  DELETE FROM user_roles
  WHERE user_id = (
    SELECT id FROM users WHERE employee_id = OLD.director_employee_id
  )
    AND role_id = (
      SELECT id FROM roles WHERE system_key = 'department_head'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM departments
      WHERE director_employee_id = OLD.director_employee_id
    );
END;
