-- Role builders need to see the organizational units they can bind a custom role to.
-- Normalize existing grants to the same dependency graph used for newly saved roles.

DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT role_create.role_id, dependency.id
FROM role_permissions AS role_create
JOIN permissions AS granted ON granted.id = role_create.permission_id
JOIN permissions AS dependency ON dependency.code IN (
  'enterprises.view',
  'departments.view'
)
WHERE granted.code = 'roles.create';

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
