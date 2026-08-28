-- Granular RBAC for custom roles.
--
-- Older releases used umbrella organization.* permissions for enterprises,
-- departments and positions, and employees.edit for education/experience records.
-- Split those capabilities into real entity-level CRUD grants while preserving
-- the effective access of every existing role.

DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

INSERT OR IGNORE INTO permissions (code, name, module, description) VALUES
  ('enterprises.view', 'Просмотр предприятий', 'Предприятия', 'Просмотр списка и карточек предприятий в пределах области роли.'),
  ('enterprises.create', 'Создание предприятий', 'Предприятия', 'Создание нового предприятия. Действие доступно только в глобальной области.'),
  ('enterprises.edit', 'Редактирование предприятий', 'Предприятия', 'Изменение реквизитов предприятия в пределах области роли.'),
  ('enterprises.delete', 'Удаление предприятий', 'Предприятия', 'Удаление или архивирование предприятия. Действие доступно только в глобальной области.'),
  ('enterprises.assign_leader', 'Управление директором предприятия', 'Предприятия', 'Назначение, замена и снятие директора предприятия как отдельное кадровое действие.'),

  ('departments.view', 'Просмотр отделов', 'Отделы', 'Просмотр отделов в пределах доступных предприятий.'),
  ('departments.create', 'Создание отделов', 'Отделы', 'Создание отдела внутри доступного предприятия.'),
  ('departments.edit', 'Редактирование отделов', 'Отделы', 'Изменение реквизитов отдела в пределах области роли.'),
  ('departments.delete', 'Удаление отделов', 'Отделы', 'Удаление или архивирование отдела. Требуется область предприятия или глобальная область.'),
  ('departments.assign_leader', 'Управление руководителем отдела', 'Отделы', 'Назначение, замена и снятие руководителя отдела как отдельное кадровое действие.'),

  ('positions.view', 'Просмотр должностей', 'Должности', 'Просмотр должностей в пределах доступных отделов.'),
  ('positions.create', 'Создание должностей', 'Должности', 'Создание должности внутри доступного отдела.'),
  ('positions.edit', 'Редактирование должностей', 'Должности', 'Изменение названия и обязанностей должности.'),
  ('positions.delete', 'Удаление должностей', 'Должности', 'Удаление или архивирование должности.'),

  ('employee_education.view', 'Просмотр образования', 'Образование сотрудников', 'Просмотр сведений об образовании сотрудников в доступной области.'),
  ('employee_education.create', 'Добавление образования', 'Образование сотрудников', 'Добавление записи об образовании сотрудника.'),
  ('employee_education.edit', 'Редактирование образования', 'Образование сотрудников', 'Изменение записи об образовании сотрудника.'),
  ('employee_education.delete', 'Удаление образования', 'Образование сотрудников', 'Удаление записи об образовании сотрудника.'),

  ('employee_experience.view', 'Просмотр опыта работы', 'Опыт работы сотрудников', 'Просмотр предыдущего опыта работы сотрудников в доступной области.'),
  ('employee_experience.create', 'Добавление опыта работы', 'Опыт работы сотрудников', 'Добавление записи о предыдущем месте работы сотрудника.'),
  ('employee_experience.edit', 'Редактирование опыта работы', 'Опыт работы сотрудников', 'Изменение записи о предыдущем месте работы сотрудника.'),
  ('employee_experience.delete', 'Удаление опыта работы', 'Опыт работы сотрудников', 'Удаление записи о предыдущем месте работы сотрудника.'),

  ('employment_history.view', 'Просмотр кадровой истории', 'Кадровая история', 'Просмотр системного журнала кадровых изменений сотрудника. Журнал остаётся неизменяемым.');

-- ---------------------------------------------------------------------------
-- Preserve existing organization access, but do not copy actions into scopes
-- where the backend cannot safely perform them.
-- ---------------------------------------------------------------------------

-- Every previous organization viewer could see all three hierarchy levels in the
-- same role scope.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT old_grant.role_id, new_permission.id
FROM role_permissions AS old_grant
JOIN permissions AS old_permission ON old_permission.id = old_grant.permission_id
JOIN permissions AS new_permission ON new_permission.code IN (
  'enterprises.view', 'departments.view', 'positions.view'
)
WHERE old_permission.code = 'organization.view';

-- Creation: global -> all levels, enterprise -> departments/positions,
-- department -> positions only.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT old_grant.role_id, new_permission.id
FROM role_permissions AS old_grant
JOIN permissions AS old_permission ON old_permission.id = old_grant.permission_id
JOIN roles AS role ON role.id = old_grant.role_id
JOIN permissions AS new_permission ON (
  (role.scope_type = 'global' AND new_permission.code IN (
    'enterprises.create', 'departments.create', 'positions.create'
  ))
  OR (role.scope_type = 'enterprise' AND new_permission.code IN (
    'departments.create', 'positions.create'
  ))
  OR (role.scope_type = 'department' AND new_permission.code = 'positions.create')
)
WHERE old_permission.code = 'organization.create';

-- Editing: a department-scoped role may edit its own department and positions,
-- but never enterprise-wide properties.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT old_grant.role_id, new_permission.id
FROM role_permissions AS old_grant
JOIN permissions AS old_permission ON old_permission.id = old_grant.permission_id
JOIN roles AS role ON role.id = old_grant.role_id
JOIN permissions AS new_permission ON (
  (role.scope_type = 'global' AND new_permission.code IN (
    'enterprises.edit', 'departments.edit', 'positions.edit'
  ))
  OR (role.scope_type = 'enterprise' AND new_permission.code IN (
    'enterprises.edit', 'departments.edit', 'positions.edit'
  ))
  OR (role.scope_type = 'department' AND new_permission.code IN (
    'departments.edit', 'positions.edit'
  ))
)
WHERE old_permission.code = 'organization.edit';

-- Deletion: only global roles can delete enterprises, only enterprise/global
-- roles can delete departments, and department roles may delete/archive positions.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT old_grant.role_id, new_permission.id
FROM role_permissions AS old_grant
JOIN permissions AS old_permission ON old_permission.id = old_grant.permission_id
JOIN roles AS role ON role.id = old_grant.role_id
JOIN permissions AS new_permission ON (
  (role.scope_type = 'global' AND new_permission.code IN (
    'enterprises.delete', 'departments.delete', 'positions.delete'
  ))
  OR (role.scope_type = 'enterprise' AND new_permission.code IN (
    'departments.delete', 'positions.delete'
  ))
  OR (role.scope_type = 'department' AND new_permission.code = 'positions.delete')
)
WHERE old_permission.code = 'organization.delete';

-- Leadership is split so a department role never gains the ability to replace an
-- enterprise director merely because it can manage its own department head.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT old_grant.role_id, new_permission.id
FROM role_permissions AS old_grant
JOIN permissions AS old_permission ON old_permission.id = old_grant.permission_id
JOIN roles AS role ON role.id = old_grant.role_id
JOIN permissions AS new_permission ON (
  (role.scope_type IN ('global', 'enterprise') AND new_permission.code IN (
    'enterprises.assign_leader', 'departments.assign_leader'
  ))
  OR (role.scope_type = 'department' AND new_permission.code = 'departments.assign_leader')
)
WHERE old_permission.code = 'organization.assign_leader';

-- ---------------------------------------------------------------------------
-- Preserve employee-card access while separating nested mutable records.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT old_grant.role_id, new_permission.id
FROM role_permissions AS old_grant
JOIN permissions AS old_permission ON old_permission.id = old_grant.permission_id
JOIN permissions AS new_permission ON new_permission.code IN (
  'employee_education.view',
  'employee_experience.view',
  'employment_history.view'
)
WHERE old_permission.code = 'employees.view';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT old_grant.role_id, new_permission.id
FROM role_permissions AS old_grant
JOIN permissions AS old_permission ON old_permission.id = old_grant.permission_id
JOIN permissions AS new_permission ON new_permission.code IN (
  'employee_education.create',
  'employee_education.edit',
  'employee_education.delete',
  'employee_experience.create',
  'employee_experience.edit',
  'employee_experience.delete'
)
WHERE old_permission.code = 'employees.edit';

-- Superadmin is the platform owner and must always receive every currently
-- available permission. profile.view is harmless on the role and is filtered from
-- the built-in system-admin session where appropriate.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
CROSS JOIN permissions AS permission
WHERE role.system_key = 'superadmin';

-- ---------------------------------------------------------------------------
-- Normalize dependencies for grants that pre-date the new graph.
-- ---------------------------------------------------------------------------

-- All nested employee data requires the employee registry.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT grant_row.role_id, employee_view.id
FROM role_permissions AS grant_row
JOIN permissions AS granted ON granted.id = grant_row.permission_id
JOIN permissions AS employee_view ON employee_view.code = 'employees.view'
WHERE granted.code LIKE 'employee_education.%'
   OR granted.code LIKE 'employee_experience.%'
   OR granted.code = 'employment_history.view';

-- Nested mutations always imply their own view permission.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT grant_row.role_id, view_permission.id
FROM role_permissions AS grant_row
JOIN permissions AS granted ON granted.id = grant_row.permission_id
JOIN permissions AS view_permission ON view_permission.code =
  CASE
    WHEN granted.code LIKE 'employee_education.%' THEN 'employee_education.view'
    WHEN granted.code LIKE 'employee_experience.%' THEN 'employee_experience.view'
  END
WHERE granted.code IN (
  'employee_education.create', 'employee_education.edit', 'employee_education.delete',
  'employee_experience.create', 'employee_experience.edit', 'employee_experience.delete'
);

-- Department and position hierarchy dependencies.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT grant_row.role_id, enterprise_view.id
FROM role_permissions AS grant_row
JOIN permissions AS granted ON granted.id = grant_row.permission_id
JOIN permissions AS enterprise_view ON enterprise_view.code = 'enterprises.view'
WHERE granted.code LIKE 'departments.%' OR granted.code LIKE 'positions.%';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT grant_row.role_id, department_view.id
FROM role_permissions AS grant_row
JOIN permissions AS granted ON granted.id = grant_row.permission_id
JOIN permissions AS department_view ON department_view.code = 'departments.view'
WHERE granted.code LIKE 'positions.%';

-- Entity mutations imply entity view.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT grant_row.role_id, view_permission.id
FROM role_permissions AS grant_row
JOIN permissions AS granted ON granted.id = grant_row.permission_id
JOIN permissions AS view_permission ON view_permission.code =
  CASE
    WHEN granted.code LIKE 'enterprises.%' THEN 'enterprises.view'
    WHEN granted.code LIKE 'departments.%' THEN 'departments.view'
    WHEN granted.code LIKE 'positions.%' THEN 'positions.view'
  END
WHERE granted.code IN (
  'enterprises.create', 'enterprises.edit', 'enterprises.delete', 'enterprises.assign_leader',
  'departments.create', 'departments.edit', 'departments.delete', 'departments.assign_leader',
  'positions.create', 'positions.edit', 'positions.delete'
);

-- Employee creation/change UI needs hierarchy lookups. Employment changes and
-- termination also expose the immutable кадровый журнал.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT grant_row.role_id, dependency.id
FROM role_permissions AS grant_row
JOIN permissions AS granted ON granted.id = grant_row.permission_id
JOIN permissions AS dependency ON dependency.code IN (
  'enterprises.view', 'departments.view', 'positions.view'
)
WHERE granted.code IN ('employees.create', 'employees.change_employment');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT grant_row.role_id, history_view.id
FROM role_permissions AS grant_row
JOIN permissions AS granted ON granted.id = grant_row.permission_id
JOIN permissions AS history_view ON history_view.code = 'employment_history.view'
WHERE granted.code IN ('employees.change_employment', 'employees.terminate');

-- Leadership actions encapsulate the employment mutation themselves. They need
-- candidates and hierarchy lookups, but do not grant generic transfer rights.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT grant_row.role_id, dependency.id
FROM role_permissions AS grant_row
JOIN permissions AS granted ON granted.id = grant_row.permission_id
JOIN permissions AS dependency ON dependency.code IN (
  'employees.view', 'employment_history.view',
  'enterprises.view', 'departments.view', 'positions.view'
)
WHERE granted.code IN ('enterprises.assign_leader', 'departments.assign_leader');

-- ---------------------------------------------------------------------------
-- Remove permissions that are impossible or unsafe in narrower scopes. These
-- grants were previously selectable even though the backend required global
-- scope, which made roles look more capable than they really were.
-- ---------------------------------------------------------------------------
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE scope_type <> 'global')
  AND permission_id IN (
    SELECT id FROM permissions WHERE code IN (
      'enterprises.create',
      'enterprises.delete',
      'audit.view',
      'employees.export',
      'settings.backups_view',
      'settings.backups_create',
      'settings.backups_restore',
      'settings.backups_open_folder'
    )
  );

DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE scope_type = 'department')
  AND permission_id IN (
    SELECT id FROM permissions WHERE code IN (
      'enterprises.edit',
      'enterprises.assign_leader',
      'departments.create',
      'departments.delete',
      'vacation_types.create',
      'vacation_types.edit',
      'vacation_types.delete',
      'document_types.create',
      'document_types.edit',
      'document_types.delete'
    )
  );

-- Old umbrella and compatibility permissions have all been mapped by previous
-- migrations and the rules above. Remove them from the live permission catalog so
-- they can never appear in effective sessions again.
DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE code IN (
    'employees.manage',
    'organization.view',
    'organization.create',
    'organization.edit',
    'organization.delete',
    'organization.assign_leader',
    'organization.manage',
    'vacations.manage',
    'recruitment.view',
    'recruitment.manage',
    'access.manage',
    'settings.manage',
    'payroll.view',
    'payroll.manage'
  )
);

DELETE FROM permissions
WHERE code IN (
  'employees.manage',
  'organization.view',
  'organization.create',
  'organization.edit',
  'organization.delete',
  'organization.assign_leader',
  'organization.manage',
  'vacations.manage',
  'recruitment.view',
  'recruitment.manage',
  'access.manage',
  'settings.manage',
  'payroll.view',
  'payroll.manage'
);

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
