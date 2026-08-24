DROP TRIGGER IF EXISTS roles_system_update_guard;

UPDATE roles
SET description = 'Обзор своего предприятия, отделов, сотрудников, отпусков и подбора в пределах предприятия.'
WHERE system_key = 'enterprise_director';

UPDATE roles
SET description = 'Обзор своего отдела, сотрудников, отпусков и подбора в пределах отдела.'
WHERE system_key = 'department_head';

CREATE TRIGGER roles_system_update_guard
BEFORE UPDATE ON roles
WHEN OLD.is_system = 1
BEGIN
  SELECT RAISE(ABORT, 'Системную роль нельзя изменять');
END;
