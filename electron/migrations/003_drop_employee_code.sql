-- requires_foreign_keys_off
CREATE TABLE employees_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER,
  position_id INTEGER,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  birth_date TEXT,
  gender TEXT,
  address TEXT,
  address_country TEXT,
  address_city TEXT,
  address_street TEXT,
  address_house TEXT,
  address_apartment TEXT,
  phone TEXT,
  email TEXT,
  hire_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  salary REAL NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
);

INSERT INTO employees_new (
  id,
  department_id,
  position_id,
  last_name,
  first_name,
  middle_name,
  birth_date,
  gender,
  address,
  address_country,
  address_city,
  address_street,
  address_house,
  address_apartment,
  phone,
  email,
  hire_date,
  status,
  salary,
  note,
  created_at,
  updated_at
)
SELECT
  id,
  department_id,
  position_id,
  last_name,
  first_name,
  middle_name,
  birth_date,
  gender,
  address,
  address_country,
  address_city,
  address_street,
  address_house,
  address_apartment,
  phone,
  email,
  hire_date,
  status,
  salary,
  note,
  created_at,
  updated_at
FROM employees;

DROP TABLE employees;
ALTER TABLE employees_new RENAME TO employees;

CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_position_id ON employees(position_id);

