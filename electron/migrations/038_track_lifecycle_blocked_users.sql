-- Track whether a user account was blocked automatically by the employee
-- lifecycle. This lets repeat hire restore only lifecycle-managed access while
-- preserving deliberate security blocks made by an administrator.

ALTER TABLE users
ADD COLUMN lifecycle_blocked INTEGER NOT NULL DEFAULT 0
CHECK (lifecycle_blocked IN (0, 1));

DROP TRIGGER IF EXISTS employees_block_user_on_inactive;
CREATE TRIGGER employees_block_user_on_inactive
AFTER UPDATE OF status ON employees
WHEN NEW.status <> 'active' AND OLD.status <> NEW.status
BEGIN
  UPDATE users
  SET lifecycle_blocked = CASE
        WHEN status = 'active' THEN 1
        ELSE lifecycle_blocked
      END,
      status = 'blocked'
  WHERE employee_id = NEW.id;
END;
