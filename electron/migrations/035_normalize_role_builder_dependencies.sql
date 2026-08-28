-- Normalize grants that became implicit dependencies in the granular role builder.

DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

-- Role builders need to see the organizational units they can bind a custom role to.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT role_create.role_id, dependency.id
FROM role_permissions AS role_create
JOIN permissions AS granted ON granted.id = role_create.permission_id
JOIN permissions AS dependency ON dependency.code IN (
  'enterprises.view',
  'departments.view'
)
WHERE granted.code = 'roles.create';

-- The attention queue now lives inside Dashboard, so attention access is unusable
-- without the Dashboard route itself.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT attention_grant.role_id, dashboard_view.id
FROM role_permissions AS attention_grant
JOIN permissions AS granted ON granted.id = attention_grant.permission_id
JOIN permissions AS dashboard_view ON dashboard_view.code = 'dashboard.view'
WHERE granted.code = 'attention.view';

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
