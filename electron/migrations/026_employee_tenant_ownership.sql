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
WHEN NEW.enterprise_id IS NOT OLD.enterprise_id
  AND NEW.department_id IS NOT NULL
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

CREATE TRIGGER employees_sync_enterprise_after_department_assignment
AFTER UPDATE OF department_id ON employees
WHEN OLD.department_id IS NOT NEW.department_id
  AND NEW.department_id IS NOT NULL
BEGIN
  UPDATE employees
  SET enterprise_id = (
    SELECT department.enterprise_id
    FROM departments AS department
    WHERE department.id = NEW.department_id
  )
  WHERE id = NEW.id;
END;

-- Re-parenting a department changes the tenant of every employee in that
-- department even though their department_id stays the same. Keep direct tenant
-- ownership synchronized so sessions, scoped roles and employee lists immediately
-- follow the new enterprise.
CREATE TRIGGER departments_sync_employee_enterprise_after_reparent
AFTER UPDATE OF enterprise_id ON departments
WHEN OLD.enterprise_id IS NOT NEW.enterprise_id
BEGIN
  UPDATE employees
  SET enterprise_id = NEW.enterprise_id
  WHERE department_id = NEW.id;
END;

-- Vacation types are enterprise dictionaries, so an employee assigned directly
-- to an enterprise can use that enterprise's dictionary even before a department
-- is selected.
DROP TRIGGER IF EXISTS trg_validate_vacation_type_scope_insert;
DROP TRIGGER IF EXISTS trg_validate_vacation_type_scope_update;

CREATE TRIGGER trg_validate_vacation_type_scope_insert
BEFORE INSERT ON vacations
WHEN NEW.vacation_type_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM employees AS employee
    LEFT JOIN departments AS department ON department.id = employee.department_id
    JOIN vacation_types AS vacation_type ON vacation_type.id = NEW.vacation_type_id
    WHERE employee.id = NEW.employee_id
      AND COALESCE(employee.enterprise_id, department.enterprise_id) IS NOT NULL
      AND vacation_type.enterprise_id = COALESCE(employee.enterprise_id, department.enterprise_id)
  ) THEN RAISE(ABORT, 'Вид отпуска не принадлежит предприятию сотрудника') END;
END;

CREATE TRIGGER trg_validate_vacation_type_scope_update
BEFORE UPDATE OF employee_id, vacation_type_id ON vacations
WHEN NEW.vacation_type_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM employees AS employee
    LEFT JOIN departments AS department ON department.id = employee.department_id
    JOIN vacation_types AS vacation_type ON vacation_type.id = NEW.vacation_type_id
    WHERE employee.id = NEW.employee_id
      AND COALESCE(employee.enterprise_id, department.enterprise_id) IS NOT NULL
      AND vacation_type.enterprise_id = COALESCE(employee.enterprise_id, department.enterprise_id)
  ) THEN RAISE(ABORT, 'Вид отпуска не принадлежит предприятию сотрудника') END;
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

-- Scoped administrators can create and export employees in their own tenant. The
-- backend stamps employee creation and filters CSV export by the effective
-- permission scope, so neither operation can cross the enterprise/department
-- boundary.
DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.code IN (
  'employees.create',
  'employees.export'
)
WHERE role.system_key IN ('enterprise_admin', 'department_admin');

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