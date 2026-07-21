DROP TRIGGER role_permissions_system_insert_guard;
DROP TRIGGER role_permissions_system_delete_guard;

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE system_key = 'employee')
  AND permission_id = (SELECT id FROM permissions WHERE code = 'dashboard.view');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.code = 'organization.view'
WHERE role.system_key = 'employee';

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
