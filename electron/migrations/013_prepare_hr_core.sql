-- Transitional migration: the following HR-core migrations rebuild organization
-- tables and update protected system role labels. Disable dependent triggers first;
-- they are recreated after the rebuild in 016_restore_hr_core_guards.sql.
DROP TRIGGER IF EXISTS roles_system_update_guard;
DROP TRIGGER IF EXISTS trg_validate_employee_assignment_insert;
DROP TRIGGER IF EXISTS trg_validate_employee_assignment_update;
DROP TRIGGER IF EXISTS trg_protect_employee_leadership_assignment;
DROP TRIGGER IF EXISTS trg_validate_enterprise_director_update;
DROP TRIGGER IF EXISTS trg_prevent_occupied_enterprise_delete;
