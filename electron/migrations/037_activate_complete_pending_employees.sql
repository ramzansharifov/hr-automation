-- Manual employee creation now represents a complete hire. Older versions
-- temporarily stored complete manually-created employees as pending_assignment
-- and required an extra "Оформить на работу" action. Normalize only pending
-- records that already have a complete assignment and hire date; incomplete
-- imported records remain pending intentionally.

CREATE TEMP TABLE _complete_pending_employee_activation_ids (
  id INTEGER PRIMARY KEY
);

INSERT INTO _complete_pending_employee_activation_ids (id)
SELECT employees.id
FROM employees
WHERE employees.lifecycle_status = 'pending_assignment'
  AND employees.enterprise_id IS NOT NULL
  AND employees.department_id IS NOT NULL
  AND employees.position_id IS NOT NULL
  AND employees.hire_date IS NOT NULL
  AND TRIM(employees.hire_date) <> '';

UPDATE employees
SET status = 'active',
    lifecycle_status = 'active',
    employment_started_at = COALESCE(employment_started_at, hire_date),
    registered_at = COALESCE(registered_at, created_at, CURRENT_TIMESTAMP),
    terminated_at = NULL,
    termination_reason = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT id FROM _complete_pending_employee_activation_ids
);

INSERT INTO employment_history (
  employee_id,
  change_type,
  previous_department_id,
  new_department_id,
  previous_position_id,
  new_position_id,
  previous_salary,
  new_salary,
  effective_at,
  reason
)
SELECT
  employee.id,
  'hired',
  NULL,
  employee.department_id,
  NULL,
  employee.position_id,
  NULL,
  employee.salary,
  employee.hire_date,
  'Приём на работу'
FROM employees AS employee
JOIN _complete_pending_employee_activation_ids AS pending
  ON pending.id = employee.id
WHERE NOT EXISTS (
  SELECT 1
  FROM employment_history AS history
  WHERE history.employee_id = employee.id
    AND history.change_type = 'hired'
);

DROP TABLE _complete_pending_employee_activation_ids;
