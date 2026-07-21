DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE system_key = 'employee')
  AND permission_id = (SELECT id FROM permissions WHERE code = 'dashboard.view');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.code = 'organization.view'
WHERE role.system_key = 'employee';
