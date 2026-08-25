-- Employees can belong to an enterprise before a department/position is assigned.
-- This closes the tenant gap for newly created employees and preserves the earlier
-- workflow where organizational assignment can be completed later as an HR change.
ALTER TABLE employees
ADD COLUMN enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE SET NULL;

UPDATE employees
SET enterprise_id = (
  SELECT department.enterprise_id
  FROM departments AS department
  WHERE department.id = employees.department_id
  LIMIT 1
)
WHERE enterprise_id IS NULL
  AND department_id IS NOT NULL;

CREATE INDEX idx_employees_enterprise_id ON employees(enterprise_id);

-- A concrete department must always belong to the employee's enterprise. Inserts
-- without enterprise_id remain valid for legacy/import code and are normalized by
-- the AFTER INSERT trigger below.
CREATE TRIGGER employees_enterprise_department_insert_guard
BEFORE INSERT ON employees
WHEN NEW.department_id IS NOT NULL
  AND NEW.enterprise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM departments AS department
    WHERE department.id = NEW.department_id
      AND department.enterprise_id = NEW.enterprise_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Отдел сотрудника должен принадлежать его предприятию');
END;

CREATE TRIGGER employees_enterprise_department_update_guard
BEFORE UPDATE OF enterprise_id, department_id ON employees
WHEN NEW.department_id IS NOT NULL
  AND NEW.enterprise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM departments AS department
    WHERE department.id = NEW.department_id
      AND department.enterprise_id = NEW.enterprise_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Отдел сотрудника должен принадлежать его предприятию');
END;

CREATE TRIGGER employees_fill_enterprise_after_insert
AFTER INSERT ON employees
WHEN NEW.enterprise_id IS NULL AND NEW.department_id IS NOT NULL
BEGIN
  UPDATE employees
  SET enterprise_id = (
    SELECT department.enterprise_id
    FROM departments AS department
    WHERE department.id = NEW.department_id
  )
  WHERE id = NEW.id;
END;

CREATE TRIGGER employees_fill_enterprise_after_department_assignment
AFTER UPDATE OF department_id ON employees
WHEN NEW.enterprise_id IS NULL AND NEW.department_id IS NOT NULL
BEGIN
  UPDATE employees
  SET enterprise_id = (
    SELECT department.enterprise_id
    FROM departments AS department
    WHERE department.id = NEW.department_id
  )
  WHERE id = NEW.id;
END;

-- Custom enterprise roles must also work for employees that belong to an
-- enterprise but have not yet been assigned to a department.
DROP TRIGGER IF EXISTS user_roles_custom_scope_insert_guard;
DROP TRIGGER IF EXISTS user_roles_custom_scope_update_guard;
DROP TRIGGER IF EXISTS employees_revoke_out_of_scope_custom_roles;

CREATE TRIGGER user_roles_custom_scope_insert_guard
BEFORE INSERT ON user_roles
WHEN EXISTS (
  SELECT 1
  FROM roles AS role
  JOIN users AS user ON user.id = NEW.user_id
  JOIN employees AS employee ON employee.id = user.employee_id
  LEFT JOIN departments AS department ON department.id = employee.department_id
  WHERE role.id = NEW.role_id
    AND role.is_system = 0
    AND (
      (role.scope_type = 'enterprise'
        AND COALESCE(employee.enterprise_id, department.enterprise_id) IS NOT role.enterprise_id)
      OR (role.scope_type = 'department' AND employee.department_id IS NOT role.department_id)
      OR role.scope_type = 'self'
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Роль не действует в организационной области выбранного сотрудника');
END;

CREATE TRIGGER user_roles_custom_scope_update_guard
BEFORE UPDATE OF user_id, role_id ON user_roles
WHEN EXISTS (
  SELECT 1
  FROM roles AS role
  JOIN users AS user ON user.id = NEW.user_id
  JOIN employees AS employee ON employee.id = user.employee_id
  LEFT JOIN departments AS department ON department.id = employee.department_id
  WHERE role.id = NEW.role_id
    AND role.is_system = 0
    AND (
      (role.scope_type = 'enterprise'
        AND COALESCE(employee.enterprise_id, department.enterprise_id) IS NOT role.enterprise_id)
      OR (role.scope_type = 'department' AND employee.department_id IS NOT role.department_id)
      OR role.scope_type = 'self'
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Роль не действует в организационной области выбранного сотрудника');
END;

CREATE TRIGGER employees_revoke_out_of_scope_custom_roles
AFTER UPDATE OF enterprise_id, department_id ON employees
WHEN OLD.enterprise_id IS NOT NEW.enterprise_id
  OR OLD.department_id IS NOT NEW.department_id
BEGIN
  DELETE FROM user_roles
  WHERE user_id = (SELECT id FROM users WHERE employee_id = NEW.id)
    AND role_id IN (
      SELECT role.id
      FROM roles AS role
      WHERE role.is_system = 0
        AND (
          (role.scope_type = 'enterprise' AND role.enterprise_id IS NOT NEW.enterprise_id)
          OR (role.scope_type = 'department' AND role.department_id IS NOT NEW.department_id)
        )
    );
END;

-- Scoped administrators can create employees in their own tenant. The backend
-- stamps the tenant automatically, so the employee can remain without a position
-- (and for an enterprise admin, without a department) until the HR assignment.
DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.code = 'employees.create'
WHERE role.system_key IN ('enterprise_admin', 'department_admin');

UPDATE roles
SET description = 'Полное администрирование сотрудников, структуры, отпусков, подбора, пользователей и ролей только в пределах предприятия сотрудника.'
WHERE system_key = 'enterprise_admin';

CREATE TRIGGER role_permissions_system_insert_guard
BEFORE INSERT ON role_permissions
WHEN EXISTS (
  SELECT 1 FROM roles WHERE id = NEW.role_id AND is_system = 1
)
BEGIN
  SELECT RAISE(ABORT, 'Разрешения системной роли нельзя изменять');
END;

CREATE TRIGGER role_permissions_system_delete_guard
BEFORE DELETE ON role_permissions
WHEN EXISTS (
  SELECT 1 FROM roles WHERE id = OLD.role_id AND is_system = 1
)
BEGIN
  SELECT RAISE(ABORT, 'Разрешения системной роли нельзя изменять');
END;