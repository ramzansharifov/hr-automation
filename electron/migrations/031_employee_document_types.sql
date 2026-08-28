-- Enterprise-scoped employee document type catalog.
-- Existing employee_documents.document_type is kept as a readable snapshot for
-- backwards compatibility; new writes also persist document_type_id.

CREATE TABLE document_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enterprise_id INTEGER NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (enterprise_id, name)
);

CREATE INDEX IF NOT EXISTS idx_document_types_enterprise_active
  ON document_types(enterprise_id, is_active, name);

-- Give every existing enterprise a useful starting catalog. Administrators can
-- rename, deactivate or delete unused entries later.
INSERT OR IGNORE INTO document_types (enterprise_id, name, is_active)
SELECT enterprise.id, defaults.name, 1
FROM enterprises AS enterprise
CROSS JOIN (
  SELECT 'Трудовой договор' AS name
  UNION ALL SELECT 'Приказ'
  UNION ALL SELECT 'Удостоверение личности / паспорт'
  UNION ALL SELECT 'Диплом / образование'
  UNION ALL SELECT 'Справка / сертификат'
  UNION ALL SELECT 'Другой документ'
) AS defaults;

-- Preserve custom legacy document-type labels that may already exist.
INSERT OR IGNORE INTO document_types (enterprise_id, name, is_active)
SELECT DISTINCT employee.enterprise_id,
  CASE document.document_type
    WHEN 'contract' THEN 'Трудовой договор'
    WHEN 'order' THEN 'Приказ'
    WHEN 'identity' THEN 'Удостоверение личности / паспорт'
    WHEN 'diploma' THEN 'Диплом / образование'
    WHEN 'certificate' THEN 'Справка / сертификат'
    WHEN 'other' THEN 'Другой документ'
    ELSE TRIM(document.document_type)
  END,
  1
FROM employee_documents AS document
JOIN employees AS employee ON employee.id = document.employee_id
WHERE employee.enterprise_id IS NOT NULL
  AND TRIM(document.document_type) <> '';

ALTER TABLE employee_documents
  ADD COLUMN document_type_id INTEGER REFERENCES document_types(id) ON DELETE RESTRICT;

UPDATE employee_documents AS document
SET document_type_id = (
  SELECT type.id
  FROM employees AS employee
  JOIN document_types AS type ON type.enterprise_id = employee.enterprise_id
  WHERE employee.id = document.employee_id
    AND LOWER(TRIM(type.name)) = LOWER(TRIM(
      CASE document.document_type
        WHEN 'contract' THEN 'Трудовой договор'
        WHEN 'order' THEN 'Приказ'
        WHEN 'identity' THEN 'Удостоверение личности / паспорт'
        WHEN 'diploma' THEN 'Диплом / образование'
        WHEN 'certificate' THEN 'Справка / сертификат'
        WHEN 'other' THEN 'Другой документ'
        ELSE document.document_type
      END
    ))
  LIMIT 1
)
WHERE document.document_type_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_employee_documents_type
  ON employee_documents(document_type_id, status, created_at DESC);

CREATE TRIGGER employee_documents_document_type_insert_guard
BEFORE INSERT ON employee_documents
WHEN NEW.document_type_id IS NULL
  OR NOT EXISTS (
    SELECT 1
    FROM document_types AS type
    JOIN employees AS employee ON employee.id = NEW.employee_id
    WHERE type.id = NEW.document_type_id
      AND type.enterprise_id = employee.enterprise_id
      AND type.is_active = 1
  )
BEGIN
  SELECT RAISE(ABORT, 'Выберите активный тип документа предприятия сотрудника');
END;

CREATE TRIGGER employee_documents_document_type_update_guard
BEFORE UPDATE OF employee_id, document_type_id ON employee_documents
WHEN NEW.document_type_id IS NULL
  OR NOT EXISTS (
    SELECT 1
    FROM document_types AS type
    JOIN employees AS employee ON employee.id = NEW.employee_id
    WHERE type.id = NEW.document_type_id
      AND type.enterprise_id = employee.enterprise_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Тип документа не принадлежит предприятию сотрудника');
END;

CREATE TRIGGER document_types_used_delete_guard
BEFORE DELETE ON document_types
WHEN EXISTS (
  SELECT 1 FROM employee_documents WHERE document_type_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'Тип документа уже используется. Отключите его вместо удаления');
END;

CREATE TRIGGER document_types_used_enterprise_guard
BEFORE UPDATE OF enterprise_id ON document_types
WHEN NEW.enterprise_id <> OLD.enterprise_id
  AND EXISTS (
    SELECT 1 FROM employee_documents WHERE document_type_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'Нельзя перенести используемый тип документа в другое предприятие');
END;

-- New enterprises receive the standard starter catalog automatically.
CREATE TRIGGER enterprises_seed_document_types
AFTER INSERT ON enterprises
BEGIN
  INSERT OR IGNORE INTO document_types (enterprise_id, name, is_active) VALUES
    (NEW.id, 'Трудовой договор', 1),
    (NEW.id, 'Приказ', 1),
    (NEW.id, 'Удостоверение личности / паспорт', 1),
    (NEW.id, 'Диплом / образование', 1),
    (NEW.id, 'Справка / сертификат', 1),
    (NEW.id, 'Другой документ', 1);
END;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

INSERT OR IGNORE INTO permissions (code, name, module, description) VALUES
  ('document_types.view', 'Просмотр типов документов', 'Типы документов', 'Просмотр справочника типов кадровых документов предприятия.'),
  ('document_types.create', 'Создание типов документов', 'Типы документов', 'Добавление типа кадрового документа предприятия.'),
  ('document_types.edit', 'Редактирование типов документов', 'Типы документов', 'Изменение названия и активности типа документа.'),
  ('document_types.delete', 'Удаление типов документов', 'Типы документов', 'Удаление неиспользуемого типа кадрового документа.');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
CROSS JOIN permissions AS permission
WHERE role.system_key IN ('superadmin', 'enterprise_admin')
  AND permission.code IN (
    'document_types.view', 'document_types.create',
    'document_types.edit', 'document_types.delete'
  );

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
CROSS JOIN permissions AS permission
WHERE role.system_key = 'department_admin'
  AND permission.code = 'document_types.view';

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
