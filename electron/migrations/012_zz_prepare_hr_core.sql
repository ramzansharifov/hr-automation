-- Transitional migration: the following HR-core migrations update descriptions and
-- display names of protected system roles, then restore the guard.
DROP TRIGGER IF EXISTS roles_system_update_guard;
