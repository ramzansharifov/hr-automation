CREATE TABLE permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  scope_type TEXT NOT NULL DEFAULT 'self'
    CHECK (scope_type IN ('global', 'enterprise', 'department', 'self')),
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  system_key TEXT UNIQUE
    CHECK (system_key IS NULL OR system_key IN ('superadmin', 'employee', 'enterprise_director', 'department_head')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (is_system = 1 AND system_key IS NOT NULL) OR
    (is_system = 0 AND system_key IS NULL)
  )
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
);

CREATE TABLE user_roles (
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

CREATE INDEX idx_permissions_module ON permissions(module);
CREATE INDEX idx_roles_scope_type ON roles(scope_type);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

INSERT INTO permissions (code, name, module, description) VALUES
  ('dashboard.view', 'Просмотр главной панели', 'Главная', 'Сводные показатели и последние события.'),
  ('profile.view', 'Просмотр профиля', 'Профиль', 'Просмотр собственной карточки сотрудника.'),
  ('employees.view', 'Просмотр сотрудников', 'Сотрудники', 'Список и карточки сотрудников в пределах области роли.'),
  ('employees.manage', 'Управление сотрудниками', 'Сотрудники', 'Создание и изменение кадровых данных.'),
  ('organization.view', 'Просмотр структуры', 'Организация', 'Предприятия, отделы и должности.'),
  ('organization.manage', 'Управление структурой', 'Организация', 'Создание и изменение предприятий, отделов и должностей.'),
  ('recruitment.view', 'Просмотр подбора', 'Подбор', 'Вакансии, кандидаты и результаты оценки.'),
  ('recruitment.manage', 'Управление подбором', 'Подбор', 'Создание и изменение вакансий и кандидатов.'),
  ('vacations.view', 'Просмотр отпусков', 'Отпуска', 'Отпуска в пределах области роли.'),
  ('vacations.manage', 'Управление отпусками', 'Отпуска', 'Создание, изменение и согласование отпусков.'),
  ('payroll.view', 'Просмотр начислений', 'Оплата', 'Начисления в пределах области роли.'),
  ('payroll.manage', 'Управление начислениями', 'Оплата', 'Создание и изменение начислений.'),
  ('filters.use', 'Использование фильтров', 'Фильтры', 'Расширенный поиск и общие реестры.'),
  ('access.manage', 'Управление доступом', 'Доступ', 'Пользователи, роли и разрешения.'),
  ('settings.manage', 'Управление настройками', 'Настройки', 'Системные настройки приложения.');

INSERT INTO roles (code, name, description, scope_type, is_system, system_key) VALUES
  ('superadmin', 'Superadmin', 'Полный доступ ко всем разделам и данным системы.', 'global', 1, 'superadmin'),
  ('employee', 'Сотрудник', 'Доступ только к собственному профилю, отпускам и начислениям.', 'self', 1, 'employee'),
  ('enterprise_director', 'Директор предприятия', 'Просмотр данных сотрудников и процессов своего предприятия.', 'enterprise', 1, 'enterprise_director'),
  ('department_head', 'Начальник отдела', 'Просмотр сотрудников и процессов своего отдела.', 'department', 1, 'department_head');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.system_key = 'superadmin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'dashboard.view',
  'profile.view',
  'vacations.view',
  'payroll.view'
)
WHERE r.system_key = 'employee';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'dashboard.view',
  'profile.view',
  'employees.view',
  'organization.view',
  'recruitment.view',
  'vacations.view',
  'payroll.view',
  'filters.use'
)
WHERE r.system_key = 'enterprise_director';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'dashboard.view',
  'profile.view',
  'employees.view',
  'organization.view',
  'recruitment.view',
  'vacations.view',
  'filters.use'
)
WHERE r.system_key = 'department_head';

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

CREATE TRIGGER employees_block_user_on_inactive
AFTER UPDATE OF status ON employees
WHEN NEW.status <> 'active' AND OLD.status <> NEW.status
BEGIN
  UPDATE users
  SET status = 'blocked'
  WHERE employee_id = NEW.id;
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

CREATE TRIGGER users_updated_at
AFTER UPDATE ON users
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER roles_updated_at
AFTER UPDATE ON roles
WHEN NEW.is_system = 0 AND NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
