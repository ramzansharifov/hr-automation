-- requires_foreign_keys_off

-- Расширяем допустимые system_key, сохраняя идентификаторы существующих ролей.
-- Перед перестроением roles временно снимаем все триггеры других таблиц,
-- которые читают roles: SQLite проверяет их SQL при DROP TABLE.
DROP TRIGGER IF EXISTS roles_system_update_guard;
DROP TRIGGER IF EXISTS roles_system_delete_guard;
DROP TRIGGER IF EXISTS roles_updated_at;
DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;
DROP TRIGGER IF EXISTS user_roles_superadmin_insert_guard;
DROP TRIGGER IF EXISTS user_roles_superadmin_update_guard;
DROP TRIGGER IF EXISTS enterprises_revoke_director_access;
DROP TRIGGER IF EXISTS departments_revoke_head_access;
DROP TRIGGER IF EXISTS enterprises_revoke_director_access_after_delete;
DROP TRIGGER IF EXISTS departments_revoke_head_access_after_delete;
DROP TRIGGER IF EXISTS enterprises_grant_director_access;
DROP TRIGGER IF EXISTS departments_grant_head_access;

CREATE TABLE roles_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  scope_type TEXT NOT NULL DEFAULT 'self'
    CHECK (scope_type IN ('global', 'enterprise', 'department', 'self')),
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  system_key TEXT UNIQUE
    CHECK (
      system_key IS NULL OR system_key IN (
        'superadmin',
        'employee',
        'enterprise_director',
        'department_head',
        'enterprise_admin',
        'department_admin'
      )
    ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (is_system = 1 AND system_key IS NOT NULL) OR
    (is_system = 0 AND system_key IS NULL)
  )
);

INSERT INTO roles_next (
  id,
  code,
  name,
  description,
  scope_type,
  is_system,
  system_key,
  created_at,
  updated_at
)
SELECT
  id,
  code,
  name,
  description,
  scope_type,
  is_system,
  system_key,
  created_at,
  updated_at
FROM roles;

DROP TABLE roles;
ALTER TABLE roles_next RENAME TO roles;
CREATE INDEX idx_roles_scope_type ON roles(scope_type);

INSERT INTO roles (
  code,
  name,
  description,
  scope_type,
  is_system,
  system_key
) VALUES
  (
    'enterprise_admin',
    'Администратор предприятия',
    'Полное операционное управление сотрудниками, структурой, отпусками и подбором только в пределах предприятия сотрудника.',
    'enterprise',
    1,
    'enterprise_admin'
  ),
  (
    'department_admin',
    'Администратор отдела',
    'Полное операционное управление сотрудниками, должностями, отпусками и подбором только в пределах отдела сотрудника.',
    'department',
    1,
    'department_admin'
  );

-- Системные администраторы области получают все кадровые и организационные
-- действия, которые имеют смысл внутри ограниченной оргструктуры. Глобальное
-- администрирование пользователей, ролей, аудита, резервных копий и справочника
-- видов отпусков намеренно не выдаётся: эти операции не имеют enterprise/department scope.
INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.code IN (
  'dashboard.view',
  'profile.view',
  'directory.view',
  'employees.view',
  'employees.edit',
  'employees.change_employment',
  'employees.terminate',
  'organization.view',
  'organization.create',
  'organization.edit',
  'organization.delete',
  'organization.assign_leader',
  'vacations.view',
  'vacations.create',
  'vacations.edit',
  'vacations.delete',
  'vacations.approve',
  'vacation_types.view',
  'vacancies.view',
  'vacancies.create',
  'vacancies.edit',
  'vacancies.delete',
  'candidates.view',
  'candidates.create',
  'candidates.edit',
  'candidates.delete',
  'candidates.hire',
  'filters.use',
  'settings.view'
)
WHERE role.system_key IN ('enterprise_admin', 'department_admin');

CREATE TRIGGER roles_system_update_guard
BEFORE UPDATE ON roles
WHEN OLD.is_system = 1
BEGIN
  SELECT RAISE(ABORT, 'Системную роль нельзя изменять');
END;

CREATE TRIGGER roles_system_delete_guard
BEFORE DELETE ON roles
WHEN OLD.is_system = 1
BEGIN
  SELECT RAISE(ABORT, 'Системную роль нельзя удалить');
END;

CREATE TRIGGER roles_updated_at
AFTER UPDATE ON roles
WHEN NEW.is_system = 0 AND NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

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

CREATE TRIGGER user_roles_superadmin_insert_guard
BEFORE INSERT ON user_roles
WHEN EXISTS (
  SELECT 1 FROM roles WHERE id = NEW.role_id AND system_key = 'superadmin'
)
BEGIN
  SELECT RAISE(ABORT, 'Роль superadmin принадлежит только встроенной системной учётной записи');
END;

CREATE TRIGGER user_roles_superadmin_update_guard
BEFORE UPDATE OF role_id ON user_roles
WHEN EXISTS (
  SELECT 1 FROM roles WHERE id = NEW.role_id AND system_key = 'superadmin'
)
BEGIN
  SELECT RAISE(ABORT, 'Роль superadmin принадлежит только встроенной системной учётной записи');
END;

CREATE TRIGGER enterprises_revoke_director_access
AFTER UPDATE OF general_director_employee_id ON enterprises
WHEN OLD.general_director_employee_id IS NOT NULL
  AND OLD.general_director_employee_id IS NOT NEW.general_director_employee_id
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

CREATE TRIGGER departments_revoke_head_access
AFTER UPDATE OF director_employee_id ON departments
WHEN OLD.director_employee_id IS NOT NULL
  AND OLD.director_employee_id IS NOT NEW.director_employee_id
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
