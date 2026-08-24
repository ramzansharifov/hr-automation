DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

INSERT OR IGNORE INTO permissions (code, name, module, description) VALUES
  ('directory.view', 'Просмотр своей команды', 'Команда', 'Просмотр своего предприятия, отдела, руководителей и безопасного справочника коллег.');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.code = 'directory.view'
WHERE role.system_key IN ('employee', 'enterprise_director', 'department_head', 'superadmin');

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
