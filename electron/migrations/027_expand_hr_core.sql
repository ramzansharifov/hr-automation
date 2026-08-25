-- HR Core expansion: lifecycle, leadership history, archival organization,
-- employee documents, leave management and data-exchange audit.

-- ---------------------------------------------------------------------------
-- Employee lifecycle
-- ---------------------------------------------------------------------------
ALTER TABLE employees ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active'
  CHECK (lifecycle_status IN ('draft', 'pending_assignment', 'active', 'terminated'));
ALTER TABLE employees ADD COLUMN employment_started_at TEXT;
ALTER TABLE employees ADD COLUMN registered_at TEXT;

UPDATE employees
SET lifecycle_status = CASE
  WHEN status = 'terminated' THEN 'terminated'
  WHEN status IN ('draft', 'pending_assignment') THEN status
  ELSE 'active'
END,
employment_started_at = CASE
  WHEN status IN ('active', 'terminated') THEN hire_date
  ELSE NULL
END,
registered_at = COALESCE(created_at, CURRENT_TIMESTAMP);

-- The legacy hire_date column remains NOT NULL for backward-compatible upgrades.
-- New code treats employment_started_at as the canonical employment start date and
-- replaces the technical hire_date placeholder when the employee is actually hired.
DROP TRIGGER IF EXISTS trg_employees_initial_employment_history;
CREATE TRIGGER trg_employees_initial_employment_history
AFTER INSERT ON employees
WHEN NEW.lifecycle_status = 'active'
BEGIN
  INSERT INTO employment_history (
    employee_id, change_type, new_department_id, new_position_id, new_salary,
    effective_at, reason
  ) VALUES (
    NEW.id, 'hired', NEW.department_id, NEW.position_id, NEW.salary,
    COALESCE(NEW.employment_started_at, NEW.hire_date), 'Приём на работу'
  );
END;

CREATE INDEX IF NOT EXISTS idx_employees_lifecycle_status
  ON employees(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_employees_employment_started_at
  ON employees(employment_started_at);

-- ---------------------------------------------------------------------------
-- Leadership lifecycle
-- ---------------------------------------------------------------------------
CREATE TABLE leadership_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('enterprise', 'department')),
  target_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('assign', 'replace', 'remove')),
  previous_leader_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  new_leader_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  previous_leader_outcome TEXT NOT NULL DEFAULT 'unassigned'
    CHECK (previous_leader_outcome IN ('unassigned', 'keep_assignment', 'transfer')),
  effective_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leadership_history_target
  ON leadership_history(target_type, target_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_leadership_history_employee
  ON leadership_history(previous_leader_employee_id, new_leader_employee_id);

-- ---------------------------------------------------------------------------
-- Archival lifecycle for organization and vacancies
-- ---------------------------------------------------------------------------
ALTER TABLE enterprises ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0
  CHECK (is_archived IN (0, 1));
ALTER TABLE enterprises ADD COLUMN archived_at TEXT;
ALTER TABLE enterprises ADD COLUMN archive_reason TEXT;

ALTER TABLE departments ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0
  CHECK (is_archived IN (0, 1));
ALTER TABLE departments ADD COLUMN archived_at TEXT;
ALTER TABLE departments ADD COLUMN archive_reason TEXT;

ALTER TABLE positions ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0
  CHECK (is_archived IN (0, 1));
ALTER TABLE positions ADD COLUMN archived_at TEXT;
ALTER TABLE positions ADD COLUMN archive_reason TEXT;

ALTER TABLE vacancies ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0
  CHECK (is_archived IN (0, 1));
ALTER TABLE vacancies ADD COLUMN archived_at TEXT;
ALTER TABLE vacancies ADD COLUMN archive_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_enterprises_archived ON enterprises(is_archived);
CREATE INDEX IF NOT EXISTS idx_departments_archived ON departments(is_archived);
CREATE INDEX IF NOT EXISTS idx_positions_archived ON positions(is_archived);
CREATE INDEX IF NOT EXISTS idx_vacancies_archived ON vacancies(is_archived);

CREATE TRIGGER departments_archived_enterprise_guard_insert
BEFORE INSERT ON departments
WHEN NEW.enterprise_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM enterprises WHERE id = NEW.enterprise_id AND is_archived = 1)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя создать отдел в архивном предприятии');
END;

CREATE TRIGGER departments_archived_enterprise_guard_update
BEFORE UPDATE OF enterprise_id ON departments
WHEN NEW.enterprise_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM enterprises WHERE id = NEW.enterprise_id AND is_archived = 1)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя перенести отдел в архивное предприятие');
END;

CREATE TRIGGER positions_archived_department_guard_insert
BEFORE INSERT ON positions
WHEN NEW.department_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM departments WHERE id = NEW.department_id AND is_archived = 1)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя создать должность в архивном отделе');
END;

CREATE TRIGGER positions_archived_department_guard_update
BEFORE UPDATE OF department_id ON positions
WHEN NEW.department_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM departments WHERE id = NEW.department_id AND is_archived = 1)
BEGIN
  SELECT RAISE(ABORT, 'Нельзя перенести должность в архивный отдел');
END;

CREATE TRIGGER employees_archived_assignment_guard_insert
BEFORE INSERT ON employees
WHEN (NEW.enterprise_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM enterprises WHERE id = NEW.enterprise_id AND is_archived = 1
      ))
   OR (NEW.department_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM departments WHERE id = NEW.department_id AND is_archived = 1
      ))
   OR (NEW.position_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM positions WHERE id = NEW.position_id AND is_archived = 1
      ))
BEGIN
  SELECT RAISE(ABORT, 'Нельзя назначить сотрудника в архивный элемент оргструктуры');
END;

CREATE TRIGGER employees_archived_assignment_guard_update
BEFORE UPDATE OF enterprise_id, department_id, position_id ON employees
WHEN (NEW.enterprise_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM enterprises WHERE id = NEW.enterprise_id AND is_archived = 1
      ))
   OR (NEW.department_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM departments WHERE id = NEW.department_id AND is_archived = 1
      ))
   OR (NEW.position_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM positions WHERE id = NEW.position_id AND is_archived = 1
      ))
BEGIN
  SELECT RAISE(ABORT, 'Нельзя назначить сотрудника в архивный элемент оргструктуры');
END;

-- ---------------------------------------------------------------------------
-- Employee documents
-- ---------------------------------------------------------------------------
CREATE TABLE employee_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employment_history_id INTEGER REFERENCES employment_history(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  relative_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL CHECK (LENGTH(sha256) = 64),
  issued_at TEXT,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  deleted_at TEXT,
  delete_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee
  ON employee_documents(employee_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_documents_event
  ON employee_documents(employment_history_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry
  ON employee_documents(expires_at) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Leave management
-- ---------------------------------------------------------------------------
CREATE TABLE work_calendar_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enterprise_id INTEGER NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  calendar_date TEXT NOT NULL,
  is_workday INTEGER NOT NULL CHECK (is_workday IN (0, 1)),
  name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (enterprise_id, calendar_date)
);

CREATE TABLE leave_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  balance_year INTEGER NOT NULL CHECK (balance_year BETWEEN 2000 AND 2200),
  entitlement_days REAL NOT NULL DEFAULT 28 CHECK (entitlement_days >= 0),
  carryover_days REAL NOT NULL DEFAULT 0 CHECK (carryover_days >= 0),
  adjustment_days REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, balance_year)
);

ALTER TABLE vacations ADD COLUMN working_days_count INTEGER NOT NULL DEFAULT 0
  CHECK (working_days_count >= 0);
ALTER TABLE vacations ADD COLUMN entitlement_year INTEGER;
ALTER TABLE vacations ADD COLUMN decision_comment TEXT;

CREATE INDEX IF NOT EXISTS idx_work_calendar_enterprise_date
  ON work_calendar_days(enterprise_id, calendar_date);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year
  ON leave_balances(employee_id, balance_year);
CREATE INDEX IF NOT EXISTS idx_vacations_overlap
  ON vacations(employee_id, starts_at, ends_at, status);

-- ---------------------------------------------------------------------------
-- Import/export traceability
-- ---------------------------------------------------------------------------
CREATE TABLE data_exchange_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL CHECK (direction IN ('import', 'export')),
  domain TEXT NOT NULL,
  format TEXT NOT NULL,
  file_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  successful_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_exchange_runs_created
  ON data_exchange_runs(created_at DESC);

-- ---------------------------------------------------------------------------
-- Permissions for the expanded HR core
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

INSERT OR IGNORE INTO permissions (code, name, module, description) VALUES
  ('documents.view', 'Просмотр документов сотрудников', 'Документы', 'Просмотр метаданных и открытие документов сотрудников.'),
  ('documents.add', 'Добавление документов сотрудников', 'Документы', 'Добавление документов в контролируемое локальное хранилище.'),
  ('documents.delete', 'Удаление документов сотрудников', 'Документы', 'Мягкое удаление документа с сохранением метаданных и аудита.'),
  ('leave.view', 'Просмотр отпускных остатков', 'Отпуска', 'Просмотр производственного календаря и отпускных остатков.'),
  ('leave.manage', 'Управление отпускными остатками', 'Отпуска', 'Настройка начислений, переносов и корректировок отпускных дней.'),
  ('leave.calendar_manage', 'Управление производственным календарём', 'Отпуска', 'Настройка рабочих, выходных и праздничных дней предприятия.'),
  ('attention.view', 'Рабочая очередь «Требует внимания»', 'Главная', 'Просмотр кадровых задач, сроков и исключительных состояний.'),
  ('analytics.view', 'Просмотр HR-аналитики', 'Аналитика', 'Просмотр кадровых показателей и динамики.'),
  ('data_exchange.import', 'Импорт кадровых данных', 'Импорт и экспорт', 'Предпросмотр, проверка и импорт сотрудников из CSV.'),
  ('data_exchange.export', 'Расширенный экспорт', 'Импорт и экспорт', 'Экспорт кадровых реестров и отчётов в CSV/XLSX.');

-- Existing system roles receive sensible defaults. Scoped authorization still
-- constrains every backend operation to the role's enterprise/department.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.system_key = 'superadmin'
  AND p.code IN (
    'documents.view', 'documents.add', 'documents.delete',
    'leave.view', 'leave.manage', 'leave.calendar_manage',
    'attention.view', 'analytics.view',
    'data_exchange.import', 'data_exchange.export'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.system_key = 'enterprise_admin'
  AND p.code IN (
    'documents.view', 'documents.add', 'documents.delete',
    'leave.view', 'leave.manage', 'leave.calendar_manage',
    'attention.view', 'analytics.view',
    'data_exchange.import', 'data_exchange.export'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.system_key = 'department_admin'
  AND p.code IN (
    'documents.view', 'documents.add', 'documents.delete',
    'leave.view', 'leave.manage',
    'attention.view', 'analytics.view',
    'data_exchange.export'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.system_key IN ('enterprise_director', 'department_head')
  AND p.code IN ('leave.view', 'attention.view', 'analytics.view');

CREATE TRIGGER role_permissions_system_insert_guard
BEFORE INSERT ON role_permissions
WHEN EXISTS (SELECT 1 FROM roles WHERE id = NEW.role_id AND is_system = 1)
BEGIN
  SELECT RAISE(ABORT, 'Разрешения системной роли нельзя изменять');
END;

CREATE TRIGGER role_permissions_system_delete_guard
BEFORE DELETE ON role_permissions
WHEN EXISTS (SELECT 1 FROM roles WHERE id = OLD.role_id AND is_system = 1)
BEGIN
  SELECT RAISE(ABORT, 'Разрешения системной роли нельзя изменять');
END;
