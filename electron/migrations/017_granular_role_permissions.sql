DROP TRIGGER IF EXISTS role_permissions_system_insert_guard;
DROP TRIGGER IF EXISTS role_permissions_system_delete_guard;

INSERT OR IGNORE INTO permissions (code, name, module, description) VALUES
  ('employees.create', 'Создание сотрудников', 'Сотрудники', 'Добавление новой карточки сотрудника.'),
  ('employees.edit', 'Редактирование сотрудников', 'Сотрудники', 'Изменение персональных и кадровых данных сотрудника.'),
  ('employees.change_employment', 'Кадровые изменения', 'Сотрудники', 'Перевод сотрудника, изменение должности, отдела, оклада и даты приёма.'),
  ('employees.terminate', 'Увольнение сотрудников', 'Сотрудники', 'Оформление увольнения активного сотрудника.'),
  ('employees.export', 'Экспорт сотрудников', 'Сотрудники', 'Выгрузка реестра сотрудников в CSV.'),

  ('organization.create', 'Создание элементов структуры', 'Предприятия', 'Создание предприятий, отделов и должностей.'),
  ('organization.edit', 'Редактирование структуры', 'Предприятия', 'Изменение предприятий, отделов и должностей.'),
  ('organization.delete', 'Удаление элементов структуры', 'Предприятия', 'Удаление предприятий, отделов и должностей.'),
  ('organization.assign_leader', 'Назначение руководителей', 'Предприятия', 'Назначение и снятие руководителя предприятия или отдела.'),

  ('vacations.create', 'Создание отпусков', 'Отпуска', 'Создание нового отпуска сотрудника.'),
  ('vacations.edit', 'Редактирование отпусков', 'Отпуска', 'Изменение запланированного отпуска.'),
  ('vacations.delete', 'Удаление отпусков', 'Отпуска', 'Удаление доступного для удаления отпуска.'),
  ('vacations.approve', 'Согласование отпусков', 'Отпуска', 'Утверждение, отклонение и завершение отпусков.'),

  ('vacancies.view', 'Просмотр вакансий', 'Вакансии', 'Просмотр списка и карточек вакансий.'),
  ('vacancies.create', 'Создание вакансий', 'Вакансии', 'Создание новой вакансии.'),
  ('vacancies.edit', 'Редактирование вакансий', 'Вакансии', 'Изменение вакансии и требований к кандидатам.'),
  ('vacancies.delete', 'Удаление вакансий', 'Вакансии', 'Удаление вакансии.'),

  ('candidates.view', 'Просмотр кандидатов', 'Кандидаты', 'Просмотр списка и карточек кандидатов.'),
  ('candidates.create', 'Создание кандидатов', 'Кандидаты', 'Добавление кандидата на вакансию.'),
  ('candidates.edit', 'Редактирование кандидатов', 'Кандидаты', 'Изменение данных, статуса и оценки кандидата.'),
  ('candidates.delete', 'Удаление кандидатов', 'Кандидаты', 'Удаление кандидата.'),
  ('candidates.hire', 'Приём кандидата на работу', 'Кандидаты', 'Создание сотрудника из кандидата и завершение найма.'),

  ('vacation_types.view', 'Просмотр видов отпусков', 'Виды отпусков', 'Просмотр справочника видов отпусков.'),
  ('vacation_types.create', 'Создание видов отпусков', 'Виды отпусков', 'Добавление нового вида отпуска.'),
  ('vacation_types.edit', 'Редактирование видов отпусков', 'Виды отпусков', 'Изменение вида отпуска.'),
  ('vacation_types.delete', 'Удаление видов отпусков', 'Виды отпусков', 'Удаление вида отпуска.'),

  ('users.view', 'Просмотр пользователей', 'Пользователи', 'Просмотр учётных записей и назначенных ролей.'),
  ('users.create', 'Создание пользователей', 'Пользователи', 'Создание учётной записи сотрудника.'),
  ('users.edit', 'Редактирование пользователей', 'Пользователи', 'Изменение логина, статуса и ролей пользователя.'),
  ('users.delete', 'Удаление пользователей', 'Пользователи', 'Удаление учётной записи пользователя.'),
  ('users.reset_password', 'Сброс пароля пользователя', 'Пользователи', 'Установка нового временного пароля.'),

  ('roles.view', 'Просмотр ролей', 'Роли', 'Просмотр ролей, разрешений и назначенных пользователей.'),
  ('roles.create', 'Создание ролей', 'Роли', 'Создание пользовательской роли.'),
  ('roles.edit', 'Редактирование ролей', 'Роли', 'Изменение пользовательской роли и её разрешений.'),
  ('roles.delete', 'Удаление ролей', 'Роли', 'Удаление пользовательской роли.'),

  ('settings.view', 'Просмотр настроек', 'Настройки', 'Открытие страницы настроек приложения.'),
  ('settings.backups_view', 'Просмотр резервных копий', 'Настройки', 'Просмотр списка локальных резервных копий.'),
  ('settings.backups_create', 'Создание резервных копий', 'Настройки', 'Создание резервной копии базы данных.'),
  ('settings.backups_restore', 'Восстановление резервных копий', 'Настройки', 'Восстановление базы данных из выбранной копии.'),
  ('settings.backups_open_folder', 'Открытие папки резервных копий', 'Настройки', 'Открытие локальной папки с резервными копиями.');

-- Сохраняем фактический доступ существующих ролей при переходе с крупных manage-разрешений.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions source ON source.id = rp.permission_id AND source.code = 'employees.manage'
JOIN permissions target ON target.code IN ('employees.create', 'employees.edit', 'employees.change_employment', 'employees.terminate');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions source ON source.id = rp.permission_id AND source.code = 'organization.manage'
JOIN permissions target ON target.code IN ('organization.create', 'organization.edit', 'organization.delete', 'organization.assign_leader');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions source ON source.id = rp.permission_id AND source.code = 'vacations.manage'
JOIN permissions target ON target.code IN ('vacations.create', 'vacations.edit', 'vacations.delete', 'vacations.approve', 'vacation_types.view', 'vacation_types.create', 'vacation_types.edit', 'vacation_types.delete');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions source ON source.id = rp.permission_id AND source.code = 'recruitment.view'
JOIN permissions target ON target.code IN ('vacancies.view', 'candidates.view');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions source ON source.id = rp.permission_id AND source.code = 'recruitment.manage'
JOIN permissions target ON target.code IN ('vacancies.create', 'vacancies.edit', 'vacancies.delete', 'candidates.create', 'candidates.edit', 'candidates.delete', 'candidates.hire');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions source ON source.id = rp.permission_id AND source.code = 'access.manage'
JOIN permissions target ON target.code IN ('users.view', 'users.create', 'users.edit', 'users.delete', 'users.reset_password', 'roles.view', 'roles.create', 'roles.edit', 'roles.delete');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions source ON source.id = rp.permission_id AND source.code = 'settings.manage'
JOIN permissions target ON target.code IN ('settings.view', 'settings.backups_view', 'settings.backups_create', 'settings.backups_restore', 'settings.backups_open_folder');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE p.code = 'settings.view';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, target.id
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions source ON source.id = rp.permission_id AND source.code = 'employees.view'
JOIN permissions target ON target.code = 'employees.export'
WHERE r.scope_type = 'global';

-- Superadmin всегда получает все разрешения, включая добавленные в этой миграции.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.system_key = 'superadmin';

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