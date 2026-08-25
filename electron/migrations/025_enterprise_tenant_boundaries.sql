-- requires_foreign_keys_off

-- Enterprise is the tenant boundary for business dictionaries and audit data.
-- Existing vacation types used to be global. Copy the current dictionary into
-- every enterprise and rebind every vacation to the copy belonging to the
-- employee's enterprise. A nullable legacy copy is kept only for historical
-- vacations of employees that are not attached to an enterprise.

CREATE TABLE vacation_types_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  is_paid_default INTEGER NOT NULL DEFAULT 1 CHECK (is_paid_default IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO vacation_types_next (
  enterprise_id, name, is_paid_default, is_active, created_at, updated_at
)
SELECT
  enterprise.id,
  vacation_type.name,
  vacation_type.is_paid_default,
  vacation_type.is_active,
  vacation_type.created_at,
  vacation_type.updated_at
FROM enterprises AS enterprise
CROSS JOIN vacation_types AS vacation_type;

INSERT INTO vacation_types_next (
  enterprise_id, name, is_paid_default, is_active, created_at, updated_at
)
SELECT
  NULL,
  vacation_type.name,
  vacation_type.is_paid_default,
  vacation_type.is_active,
  vacation_type.created_at,
  vacation_type.updated_at
FROM vacation_types AS vacation_type
WHERE EXISTS (
  SELECT 1
  FROM vacations AS vacation
  JOIN employees AS employee ON employee.id = vacation.employee_id
  LEFT JOIN departments AS department ON department.id = employee.department_id
  WHERE vacation.vacation_type_id = vacation_type.id
    AND department.enterprise_id IS NULL
);

UPDATE vacations
SET vacation_type_id = (
  SELECT scoped_type.id
  FROM vacation_types AS old_type
  JOIN employees AS employee ON employee.id = vacations.employee_id
  LEFT JOIN departments AS department ON department.id = employee.department_id
  JOIN vacation_types_next AS scoped_type
    ON scoped_type.name = old_type.name COLLATE NOCASE
   AND scoped_type.enterprise_id IS department.enterprise_id
  WHERE old_type.id = vacations.vacation_type_id
  LIMIT 1
);

DROP TABLE vacation_types;
ALTER TABLE vacation_types_next RENAME TO vacation_types;

CREATE INDEX idx_vacation_types_enterprise_id ON vacation_types(enterprise_id);
CREATE UNIQUE INDEX uq_vacation_types_enterprise_name
  ON vacation_types(enterprise_id, name COLLATE NOCASE)
  WHERE enterprise_id IS NOT NULL;
CREATE UNIQUE INDEX uq_vacation_types_legacy_name
  ON vacation_types(name COLLATE NOCASE)
  WHERE enterprise_id IS NULL;

CREATE TRIGGER vacation_types_require_enterprise_insert
BEFORE INSERT ON vacation_types
WHEN NEW.enterprise_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Вид отпуска должен быть привязан к предприятию');
END;

CREATE TRIGGER vacation_types_require_enterprise_update
BEFORE UPDATE ON vacation_types
WHEN NEW.enterprise_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Исторический вид отпуска без предприятия нельзя изменять');
END;

CREATE TRIGGER vacation_types_updated_at
AFTER UPDATE ON vacation_types
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE vacation_types SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- A vacation may use only a vacation type from the same enterprise as the
-- employee. This prevents renderer or direct SQL writes from crossing tenants.
CREATE TRIGGER trg_validate_vacation_type_scope_insert
BEFORE INSERT ON vacations
WHEN NEW.vacation_type_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM employees AS employee
    JOIN departments AS department ON department.id = employee.department_id
    JOIN vacation_types AS vacation_type ON vacation_type.id = NEW.vacation_type_id
    WHERE employee.id = NEW.employee_id
      AND department.enterprise_id IS NOT NULL
      AND vacation_type.enterprise_id = department.enterprise_id
  ) THEN RAISE(ABORT, 'Вид отпуска не принадлежит предприятию сотрудника') END;
END;

CREATE TRIGGER trg_validate_vacation_type_scope_update
BEFORE UPDATE OF employee_id, vacation_type_id ON vacations
WHEN NEW.vacation_type_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM employees AS employee
    JOIN departments AS department ON department.id = employee.department_id
    JOIN vacation_types AS vacation_type ON vacation_type.id = NEW.vacation_type_id
    WHERE employee.id = NEW.employee_id
      AND department.enterprise_id IS NOT NULL
      AND vacation_type.enterprise_id = department.enterprise_id
  ) THEN RAISE(ABORT, 'Вид отпуска не принадлежит предприятию сотрудника') END;
END;

-- Every newly created legal entity receives its own independent default catalog.
CREATE TRIGGER enterprises_seed_vacation_types
AFTER INSERT ON enterprises
BEGIN
  INSERT INTO vacation_types (enterprise_id, name, is_paid_default, is_active)
  VALUES
    (NEW.id, 'Ежегодный отпуск', 1, 1),
    (NEW.id, 'Отпуск без сохранения заработной платы', 0, 1),
    (NEW.id, 'Учебный отпуск', 1, 1),
    (NEW.id, 'Отпуск по беременности и родам', 1, 1),
    (NEW.id, 'Отпуск по уходу за ребёнком', 0, 1);
END;

-- Audit events carry the tenant context at the moment of the operation. This is
-- intentionally denormalized: later employee transfers must not move historical
-- audit records to another enterprise.
ALTER TABLE audit_events
ADD COLUMN enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE SET NULL;

ALTER TABLE audit_events
ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX idx_audit_events_enterprise_id ON audit_events(enterprise_id);
CREATE INDEX idx_audit_events_department_id ON audit_events(department_id);

-- Best-effort backfill for historical employee-user events. New events are always
-- written with an explicit snapshot of the tenant context by AuditService.
UPDATE audit_events
SET department_id = (
      SELECT employee.department_id
      FROM users AS user
      JOIN employees AS employee ON employee.id = user.employee_id
      WHERE user.id = audit_events.actor_account_id
      LIMIT 1
    )
WHERE actor_account_type = 'employee_user'
  AND department_id IS NULL;

UPDATE audit_events
SET enterprise_id = (
      SELECT department.enterprise_id
      FROM departments AS department
      WHERE department.id = audit_events.department_id
      LIMIT 1
    )
WHERE enterprise_id IS NULL
  AND department_id IS NOT NULL;

-- Scoped administrators now own the enterprise-level HR dictionary and their
-- scoped audit journal. Department admins may inspect the enterprise vacation
-- dictionary, but only enterprise admins may change this enterprise-wide data.
DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.code IN (
  'vacation_types.create',
  'vacation_types.edit',
  'vacation_types.delete',
  'audit.view'
)
WHERE role.system_key = 'enterprise_admin';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.code = 'audit.view'
WHERE role.system_key = 'department_admin';

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
