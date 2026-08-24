-- Leadership is an employment position of its own. A director/head must not keep
-- a regular position (for example HR manager) at the same time.

CREATE TEMP TABLE leadership_position_normalization (
  employee_id INTEGER PRIMARY KEY,
  leadership_type TEXT NOT NULL,
  target_name TEXT NOT NULL
);

INSERT OR IGNORE INTO leadership_position_normalization (
  employee_id, leadership_type, target_name
)
SELECT general_director_employee_id, 'enterprise_director', name
FROM enterprises
WHERE general_director_employee_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = enterprises.general_director_employee_id
      AND employees.position_id IS NOT NULL
  );

INSERT OR IGNORE INTO leadership_position_normalization (
  employee_id, leadership_type, target_name
)
SELECT director_employee_id, 'department_leader', name
FROM departments
WHERE director_employee_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = departments.director_employee_id
      AND employees.position_id IS NOT NULL
  );

UPDATE employees
SET position_id = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT employee_id FROM leadership_position_normalization
);

UPDATE employment_history
SET change_type = (
      SELECT leadership_type
      FROM leadership_position_normalization AS normalization
      WHERE normalization.employee_id = employment_history.employee_id
    ),
    reason = CASE
      WHEN (
        SELECT leadership_type
        FROM leadership_position_normalization AS normalization
        WHERE normalization.employee_id = employment_history.employee_id
      ) = 'enterprise_director'
        THEN 'Должность заменена назначением директором предприятия «' || (
          SELECT target_name
          FROM leadership_position_normalization AS normalization
          WHERE normalization.employee_id = employment_history.employee_id
        ) || '»'
      ELSE 'Должность заменена назначением руководителем отдела «' || (
        SELECT target_name
        FROM leadership_position_normalization AS normalization
        WHERE normalization.employee_id = employment_history.employee_id
      ) || '»'
    END
WHERE id IN (
  SELECT MAX(history.id)
  FROM employment_history AS history
  JOIN leadership_position_normalization AS normalization
    ON normalization.employee_id = history.employee_id
  GROUP BY history.employee_id
);

DROP TABLE leadership_position_normalization;
