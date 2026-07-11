CREATE TABLE IF NOT EXISTS enterprises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  legal_name TEXT,
  registration_number TEXT,
  general_director_employee_id INTEGER,
  phone TEXT,
  email TEXT,
  address TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (general_director_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

ALTER TABLE departments ADD COLUMN enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE SET NULL;
ALTER TABLE departments ADD COLUMN director_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE positions ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE vacations ADD COLUMN is_paid INTEGER NOT NULL DEFAULT 1;
ALTER TABLE vacations ADD COLUMN payment_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE vacations ADD COLUMN approved_at TEXT;

CREATE TABLE IF NOT EXISTS employment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  change_type TEXT NOT NULL,
  previous_department_id INTEGER,
  new_department_id INTEGER,
  previous_position_id INTEGER,
  new_position_id INTEGER,
  previous_salary REAL,
  new_salary REAL,
  effective_at TEXT NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (previous_department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (new_department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (previous_position_id) REFERENCES positions(id) ON DELETE SET NULL,
  FOREIGN KEY (new_position_id) REFERENCES positions(id) ON DELETE SET NULL
);

INSERT INTO employment_history (
  employee_id, change_type, new_department_id, new_position_id, new_salary,
  effective_at, reason
)
SELECT id, 'hired', department_id, position_id, salary, hire_date, 'Первичное назначение'
FROM employees
WHERE NOT EXISTS (
  SELECT 1 FROM employment_history history WHERE history.employee_id = employees.id
);

CREATE TRIGGER IF NOT EXISTS trg_employees_employment_history
AFTER UPDATE OF department_id, position_id, salary ON employees
WHEN OLD.department_id IS NOT NEW.department_id
  OR OLD.position_id IS NOT NEW.position_id
  OR OLD.salary IS NOT NEW.salary
BEGIN
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
  ) VALUES (
    NEW.id,
    CASE
      WHEN OLD.position_id IS NOT NEW.position_id AND OLD.salary IS NOT NEW.salary THEN 'position_and_salary'
      WHEN OLD.position_id IS NOT NEW.position_id THEN 'position'
      WHEN OLD.department_id IS NOT NEW.department_id THEN 'department'
      ELSE 'salary'
    END,
    OLD.department_id,
    NEW.department_id,
    OLD.position_id,
    NEW.position_id,
    OLD.salary,
    NEW.salary,
    CURRENT_DATE,
    'Изменение данных сотрудника'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_employees_initial_employment_history
AFTER INSERT ON employees
BEGIN
  INSERT INTO employment_history (
    employee_id, change_type, new_department_id, new_position_id, new_salary,
    effective_at, reason
  ) VALUES (
    NEW.id, 'hired', NEW.department_id, NEW.position_id, NEW.salary,
    NEW.hire_date, 'Приём на работу'
  );
END;

CREATE INDEX IF NOT EXISTS idx_departments_enterprise_id ON departments(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_positions_department_id ON positions(department_id);
CREATE INDEX IF NOT EXISTS idx_employment_history_employee_id ON employment_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_employment_history_effective_at ON employment_history(effective_at);
