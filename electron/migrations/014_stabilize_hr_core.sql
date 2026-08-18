-- requires_foreign_keys_off

-- Security: the built-in account may keep the development password only until the
-- first real login. Existing installations where the password was already changed
-- are left untouched.
UPDATE system_admin_accounts
SET must_change_password = 1
WHERE password_hash = '73393f40992dbf55ecb676a6280be2e0273a0e01a6114cf2aab921483ee5131a5be6c3e4e603414122368c52c2d657d5f54908323779afb57dda975928db60a8'
  AND password_salt = '8f0a4d69f5372f61b4c2d5e94a1f30c7';

UPDATE roles
SET description = 'Доступ только к собственному профилю и отпускам.'
WHERE system_key = 'employee';

-- Enterprise classification.
ALTER TABLE enterprises ADD COLUMN legal_form TEXT NOT NULL DEFAULT 'ООО'
  CHECK (legal_form IN ('ООО', 'ЗАО', 'ОАО', 'АО', 'ИП', 'ГУП', 'НКО', 'Другое'));

-- Employee lifecycle and HR-only employment metadata.
ALTER TABLE employees ADD COLUMN employee_number TEXT;
ALTER TABLE employees ADD COLUMN employment_type TEXT NOT NULL DEFAULT 'full_time'
  CHECK (employment_type IN ('full_time', 'part_time', 'temporary', 'internship'));
ALTER TABLE employees ADD COLUMN contract_number TEXT;
ALTER TABLE employees ADD COLUMN contract_date TEXT;
ALTER TABLE employees ADD COLUMN contract_end_date TEXT;
ALTER TABLE employees ADD COLUMN probation_end_date TEXT;
ALTER TABLE employees ADD COLUMN workplace TEXT;
ALTER TABLE employees ADD COLUMN terminated_at TEXT;
ALTER TABLE employees ADD COLUMN termination_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_employee_number
  ON employees(employee_number COLLATE NOCASE)
  WHERE employee_number IS NOT NULL AND TRIM(employee_number) <> '';

-- Rebuild departments and positions to remove global UNIQUE(name) constraints.
-- Names are unique only inside their parent organizational unit.
DROP TRIGGER IF EXISTS trg_validate_department_director_insert;
DROP TRIGGER IF EXISTS trg_validate_department_director_update;
DROP TRIGGER IF EXISTS trg_prevent_occupied_department_delete;
DROP TRIGGER IF EXISTS trg_prevent_occupied_department_move;
DROP TRIGGER IF EXISTS departments_revoke_head_access;
DROP TRIGGER IF EXISTS departments_revoke_head_access_after_delete;
DROP TRIGGER IF EXISTS trg_prevent_occupied_position_delete;
DROP TRIGGER IF EXISTS trg_prevent_occupied_position_move;

CREATE TABLE departments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE SET NULL,
  director_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  phone TEXT,
  email TEXT,
  location TEXT,
  created_on TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (enterprise_id, name)
);

INSERT INTO departments_new (
  id, enterprise_id, director_employee_id, name, phone, email, location,
  created_on, created_at, updated_at
)
SELECT
  id, enterprise_id, director_employee_id, name, phone, email, location,
  created_on, created_at, updated_at
FROM departments;

DROP TABLE departments;
ALTER TABLE departments_new RENAME TO departments;

CREATE TABLE positions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  responsibilities TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (department_id, name)
);

INSERT INTO positions_new (
  id, department_id, name, responsibilities, created_at, updated_at
)
SELECT id, department_id, name, responsibilities, created_at, updated_at
FROM positions;

DROP TABLE positions;
ALTER TABLE positions_new RENAME TO positions;

CREATE INDEX IF NOT EXISTS idx_departments_enterprise_id ON departments(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_positions_department_id ON positions(department_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_director
  ON departments(director_employee_id)
  WHERE director_employee_id IS NOT NULL;

CREATE TRIGGER trg_validate_department_director_insert
AFTER INSERT ON departments
WHEN NEW.director_employee_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM employees
  WHERE id = NEW.director_employee_id
    AND status = 'active'
    AND department_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'Руководитель отдела должен быть активным сотрудником этого отдела');
END;

CREATE TRIGGER trg_validate_department_director_update
BEFORE UPDATE OF director_employee_id ON departments
WHEN NEW.director_employee_id IS NOT NULL AND (
  NOT EXISTS (
    SELECT 1 FROM employees
    WHERE id = NEW.director_employee_id
      AND status = 'active'
      AND department_id = NEW.id
  ) OR EXISTS (
    SELECT 1 FROM enterprises
    WHERE general_director_employee_id = NEW.director_employee_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'Руководитель отдела должен быть активным сотрудником этого отдела без другой руководящей роли');
END;

CREATE TRIGGER trg_prevent_occupied_position_delete
BEFORE DELETE ON positions
WHEN EXISTS (SELECT 1 FROM employees WHERE position_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя удалить должность, на которую назначены сотрудники');
END;

CREATE TRIGGER trg_prevent_occupied_position_move
BEFORE UPDATE OF department_id ON positions
WHEN OLD.department_id IS NOT NEW.department_id
  AND EXISTS (SELECT 1 FROM employees WHERE position_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя перенести должность, на которую назначены сотрудники');
END;

CREATE TRIGGER trg_prevent_occupied_department_delete
BEFORE DELETE ON departments
WHEN EXISTS (SELECT 1 FROM employees WHERE department_id = OLD.id)
  OR EXISTS (SELECT 1 FROM positions WHERE department_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя удалить отдел с сотрудниками или должностями');
END;

CREATE TRIGGER trg_prevent_occupied_department_move
BEFORE UPDATE OF enterprise_id ON departments
WHEN OLD.enterprise_id IS NOT NEW.enterprise_id AND (
  EXISTS (SELECT 1 FROM employees WHERE department_id = OLD.id)
  OR EXISTS (SELECT 1 FROM positions WHERE department_id = OLD.id)
)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя перенести непустой отдел в другое предприятие');
END;

CREATE TRIGGER departments_revoke_head_access
AFTER UPDATE OF director_employee_id ON departments
WHEN OLD.director_employee_id IS NOT NULL
  AND OLD.director_employee_id IS NOT NEW.director_employee_id
BEGIN
  DELETE FROM user_roles
  WHERE user_id = (SELECT id FROM users WHERE employee_id = OLD.director_employee_id)
    AND role_id = (SELECT id FROM roles WHERE system_key = 'department_head')
    AND NOT EXISTS (
      SELECT 1 FROM departments
      WHERE director_employee_id = OLD.director_employee_id
    );
END;

CREATE TRIGGER departments_revoke_head_access_after_delete
AFTER DELETE ON departments
WHEN OLD.director_employee_id IS NOT NULL
BEGIN
  DELETE FROM user_roles
  WHERE user_id = (SELECT id FROM users WHERE employee_id = OLD.director_employee_id)
    AND role_id = (SELECT id FROM roles WHERE system_key = 'department_head')
    AND NOT EXISTS (
      SELECT 1 FROM departments
      WHERE director_employee_id = OLD.director_employee_id
    );
END;

-- Remove generic note fields from the HR domain. Reasons, responsibilities,
-- sources and descriptions remain because they have explicit business meaning.
ALTER TABLE enterprises DROP COLUMN note;
ALTER TABLE employees DROP COLUMN note;
ALTER TABLE employee_education DROP COLUMN note;
ALTER TABLE employee_experience DROP COLUMN note;
ALTER TABLE employment_history DROP COLUMN note;
ALTER TABLE vacations DROP COLUMN note;
ALTER TABLE vacancies DROP COLUMN note;
ALTER TABLE vacancy_skills DROP COLUMN note;
ALTER TABLE candidates DROP COLUMN note;
ALTER TABLE candidate_skill_scores DROP COLUMN note;

-- Configurable vacation types. Existing textual values are preserved by creating
-- dictionary entries for them before the legacy column is removed.
CREATE TABLE vacation_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  is_paid_default INTEGER NOT NULL DEFAULT 1 CHECK (is_paid_default IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO vacation_types (name, is_paid_default)
VALUES
  ('Ежегодный отпуск', 1),
  ('Отпуск без сохранения заработной платы', 0),
  ('Учебный отпуск', 1),
  ('Отпуск по беременности и родам', 1),
  ('Отпуск по уходу за ребёнком', 0);

INSERT OR IGNORE INTO vacation_types (name, is_paid_default)
SELECT DISTINCT TRIM(vacation_type), MAX(is_paid)
FROM vacations
WHERE vacation_type IS NOT NULL AND TRIM(vacation_type) <> ''
GROUP BY LOWER(TRIM(vacation_type));

ALTER TABLE vacations ADD COLUMN vacation_type_id INTEGER REFERENCES vacation_types(id) ON DELETE RESTRICT;
UPDATE vacations
SET vacation_type_id = (
  SELECT id FROM vacation_types
  WHERE LOWER(vacation_types.name) = LOWER(TRIM(vacations.vacation_type))
  LIMIT 1
);
ALTER TABLE vacations DROP COLUMN vacation_type;

ALTER TABLE vacations ADD COLUMN approved_by_account_type TEXT
  CHECK (approved_by_account_type IS NULL OR approved_by_account_type IN ('system_admin', 'employee_user'));
ALTER TABLE vacations ADD COLUMN approved_by_account_id INTEGER;
ALTER TABLE vacations ADD COLUMN approved_by_name TEXT;

CREATE INDEX IF NOT EXISTS idx_vacations_type_id ON vacations(vacation_type_id);

-- Candidate lifecycle: keep immutable status history and link the hired candidate
-- to the created employee.
ALTER TABLE candidates ADD COLUMN employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_employee_id
  ON candidates(employee_id)
  WHERE employee_id IS NOT NULL;

CREATE TABLE candidate_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO candidate_status_history (candidate_id, previous_status, new_status, reason)
SELECT id, NULL, status, 'Исходное состояние при включении истории'
FROM candidates;

CREATE TRIGGER candidates_status_history
AFTER UPDATE OF status ON candidates
WHEN OLD.status IS NOT NEW.status
BEGIN
  INSERT INTO candidate_status_history (
    candidate_id, previous_status, new_status, reason
  ) VALUES (
    NEW.id, OLD.status, NEW.status, 'Изменение этапа подбора'
  );
END;

CREATE INDEX IF NOT EXISTS idx_candidate_status_history_candidate
  ON candidate_status_history(candidate_id, changed_at DESC);

-- Immutable administrative audit trail.
CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_account_type TEXT NOT NULL
    CHECK (actor_account_type IN ('system_admin', 'employee_user', 'system')),
  actor_account_id INTEGER,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at
  ON audit_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor
  ON audit_events(actor_username, occurred_at DESC);

-- Global e-mail uniqueness across every entity that owns an e-mail address.
CREATE VIEW all_registered_emails AS
SELECT 'enterprise' AS entity_type, id AS entity_id, LOWER(TRIM(email)) AS normalized_email
FROM enterprises WHERE email IS NOT NULL AND TRIM(email) <> ''
UNION ALL
SELECT 'department', id, LOWER(TRIM(email))
FROM departments WHERE email IS NOT NULL AND TRIM(email) <> ''
UNION ALL
SELECT 'employee', id, LOWER(TRIM(email))
FROM employees WHERE email IS NOT NULL AND TRIM(email) <> ''
UNION ALL
SELECT 'candidate', id, LOWER(TRIM(email))
FROM candidates WHERE email IS NOT NULL AND TRIM(email) <> '';

CREATE VIEW email_conflicts AS
SELECT normalized_email, COUNT(*) AS usage_count
FROM all_registered_emails
GROUP BY normalized_email
HAVING COUNT(*) > 1;

CREATE INDEX IF NOT EXISTS idx_enterprises_email_normalized
  ON enterprises(LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) <> '';
CREATE INDEX IF NOT EXISTS idx_departments_email_normalized
  ON departments(LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) <> '';
CREATE INDEX IF NOT EXISTS idx_employees_email_normalized
  ON employees(LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) <> '';
CREATE INDEX IF NOT EXISTS idx_candidates_email_normalized
  ON candidates(LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) <> '';

CREATE TRIGGER enterprises_email_unique_insert
BEFORE INSERT ON enterprises
WHEN NEW.email IS NOT NULL AND TRIM(NEW.email) <> ''
  AND EXISTS (
    SELECT 1 FROM all_registered_emails
    WHERE normalized_email = LOWER(TRIM(NEW.email))
  )
BEGIN
  SELECT RAISE(ABORT, 'Электронная почта уже используется в системе');
END;

CREATE TRIGGER enterprises_email_unique_update
BEFORE UPDATE OF email ON enterprises
WHEN NEW.email IS NOT NULL AND TRIM(NEW.email) <> ''
  AND EXISTS (
    SELECT 1 FROM all_registered_emails
    WHERE normalized_email = LOWER(TRIM(NEW.email))
      AND NOT (entity_type = 'enterprise' AND entity_id = OLD.id)
  )
BEGIN
  SELECT RAISE(ABORT, 'Электронная почта уже используется в системе');
END;

CREATE TRIGGER departments_email_unique_insert
BEFORE INSERT ON departments
WHEN NEW.email IS NOT NULL AND TRIM(NEW.email) <> ''
  AND EXISTS (
    SELECT 1 FROM all_registered_emails
    WHERE normalized_email = LOWER(TRIM(NEW.email))
  )
BEGIN
  SELECT RAISE(ABORT, 'Электронная почта уже используется в системе');
END;

CREATE TRIGGER departments_email_unique_update
BEFORE UPDATE OF email ON departments
WHEN NEW.email IS NOT NULL AND TRIM(NEW.email) <> ''
  AND EXISTS (
    SELECT 1 FROM all_registered_emails
    WHERE normalized_email = LOWER(TRIM(NEW.email))
      AND NOT (entity_type = 'department' AND entity_id = OLD.id)
  )
BEGIN
  SELECT RAISE(ABORT, 'Электронная почта уже используется в системе');
END;

CREATE TRIGGER employees_email_unique_insert
BEFORE INSERT ON employees
WHEN NEW.email IS NOT NULL AND TRIM(NEW.email) <> ''
  AND EXISTS (
    SELECT 1 FROM all_registered_emails
    WHERE normalized_email = LOWER(TRIM(NEW.email))
  )
BEGIN
  SELECT RAISE(ABORT, 'Электронная почта уже используется в системе');
END;

CREATE TRIGGER employees_email_unique_update
BEFORE UPDATE OF email ON employees
WHEN NEW.email IS NOT NULL AND TRIM(NEW.email) <> ''
  AND EXISTS (
    SELECT 1 FROM all_registered_emails
    WHERE normalized_email = LOWER(TRIM(NEW.email))
      AND NOT (entity_type = 'employee' AND entity_id = OLD.id)
  )
BEGIN
  SELECT RAISE(ABORT, 'Электронная почта уже используется в системе');
END;

CREATE TRIGGER candidates_email_unique_insert
BEFORE INSERT ON candidates
WHEN NEW.email IS NOT NULL AND TRIM(NEW.email) <> ''
  AND EXISTS (
    SELECT 1 FROM all_registered_emails
    WHERE normalized_email = LOWER(TRIM(NEW.email))
  )
BEGIN
  SELECT RAISE(ABORT, 'Электронная почта уже используется в системе');
END;

CREATE TRIGGER candidates_email_unique_update
BEFORE UPDATE OF email ON candidates
WHEN NEW.email IS NOT NULL AND TRIM(NEW.email) <> ''
  AND EXISTS (
    SELECT 1 FROM all_registered_emails
    WHERE normalized_email = LOWER(TRIM(NEW.email))
      AND NOT (entity_type = 'candidate' AND entity_id = OLD.id)
  )
BEGIN
  SELECT RAISE(ABORT, 'Электронная почта уже используется в системе');
END;

-- Global administrative audit permission.
DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
INSERT OR IGNORE INTO permissions (code, name, module, description)
VALUES ('audit.view', 'Просмотр журнала действий', 'Администрирование', 'Неизменяемый журнал действий пользователей и системного администратора.');
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.code = 'audit.view'
WHERE role.system_key = 'superadmin';
CREATE TRIGGER role_permissions_system_insert_guard
BEFORE INSERT ON role_permissions
WHEN EXISTS (
  SELECT 1 FROM roles WHERE id = NEW.role_id AND is_system = 1
)
BEGIN
  SELECT RAISE(ABORT, 'Разрешения системной роли нельзя изменять');
END;

-- Local system configuration used by backups and administrative tools.
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO system_settings (key, value) VALUES
  ('backup.enabled', 'true'),
  ('backup.keep_count', '10');
