-- Custom access roles can now be bound to one enterprise or one department.
-- System roles remain generic: their enterprise/department scope follows the
-- current organizational assignment of the employee who owns the account.

ALTER TABLE roles
ADD COLUMN enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE RESTRICT;

ALTER TABLE roles
ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT;

CREATE INDEX idx_roles_enterprise_id ON roles(enterprise_id);
CREATE INDEX idx_roles_department_id ON roles(department_id);

DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

-- Scoped administrators may administer users and build roles inside their own
-- organizational boundary. The permission scope is still enterprise/department,
-- so these permissions never become global merely because they exist on the role.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.code IN (
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'users.reset_password',
  'roles.view',
  'roles.create',
  'roles.edit',
  'roles.delete'
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

-- A custom role has exactly one immutable organizational meaning:
-- global, one enterprise, or one department. Self-scoped custom roles are not
-- supported because the built-in employee role already represents self access.
CREATE TRIGGER roles_custom_scope_insert_guard
BEFORE INSERT ON roles
WHEN NEW.is_system = 0 AND (
  NEW.scope_type = 'self'
  OR (NEW.scope_type = 'global' AND (NEW.enterprise_id IS NOT NULL OR NEW.department_id IS NOT NULL))
  OR (NEW.scope_type = 'enterprise' AND (NEW.enterprise_id IS NULL OR NEW.department_id IS NOT NULL))
  OR (NEW.scope_type = 'department' AND (NEW.enterprise_id IS NOT NULL OR NEW.department_id IS NULL))
)
BEGIN
  SELECT RAISE(ABORT, 'Некорректная область пользовательской роли');
END;

CREATE TRIGGER roles_custom_scope_update_guard
BEFORE UPDATE OF scope_type, enterprise_id, department_id, is_system ON roles
WHEN NEW.is_system = 0 AND (
  NEW.scope_type = 'self'
  OR (NEW.scope_type = 'global' AND (NEW.enterprise_id IS NOT NULL OR NEW.department_id IS NOT NULL))
  OR (NEW.scope_type = 'enterprise' AND (NEW.enterprise_id IS NULL OR NEW.department_id IS NOT NULL))
  OR (NEW.scope_type = 'department' AND (NEW.enterprise_id IS NOT NULL OR NEW.department_id IS NULL))
)
BEGIN
  SELECT RAISE(ABORT, 'Некорректная область пользовательской роли');
END;

-- Defence in depth: even a direct SQL write cannot assign an enterprise/department
-- custom role to a user outside the role's bound organizational context.
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
      (role.scope_type = 'enterprise' AND department.enterprise_id IS NOT role.enterprise_id)
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
      (role.scope_type = 'enterprise' AND department.enterprise_id IS NOT role.enterprise_id)
      OR (role.scope_type = 'department' AND employee.department_id IS NOT role.department_id)
      OR role.scope_type = 'self'
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Роль не действует в организационной области выбранного сотрудника');
END;

-- A bound custom role must not "travel" with an employee after a transfer.
-- Enterprise roles survive transfers between departments of the same enterprise;
-- department roles are revoked as soon as the employee leaves that department.
CREATE TRIGGER employees_revoke_out_of_scope_custom_roles
AFTER UPDATE OF department_id ON employees
WHEN OLD.department_id IS NOT NEW.department_id
BEGIN
  DELETE FROM user_roles
  WHERE user_id = (SELECT id FROM users WHERE employee_id = NEW.id)
    AND role_id IN (
      SELECT role.id
      FROM roles AS role
      LEFT JOIN departments AS current_department ON current_department.id = NEW.department_id
      WHERE role.is_system = 0
        AND (
          (role.scope_type = 'enterprise' AND role.enterprise_id IS NOT current_department.enterprise_id)
          OR (role.scope_type = 'department' AND role.department_id IS NOT NEW.department_id)
        )
    );
END;
