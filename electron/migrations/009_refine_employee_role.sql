DROP TRIGGER role_permissions_system_delete_guard;

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE system_key = 'employee')
  AND permission_id = (SELECT id FROM permissions WHERE code = 'dashboard.view');

CREATE TRIGGER role_permissions_system_delete_guard
BEFORE DELETE ON role_permissions
WHEN EXISTS (
  SELECT 1 FROM roles WHERE id = OLD.role_id AND is_system = 1
)
BEGIN
  SELECT RAISE(ABORT, 'Разрешения системной роли нельзя изменять');
END;
