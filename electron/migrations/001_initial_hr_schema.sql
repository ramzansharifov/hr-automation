CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  manager_name TEXT,
  phone TEXT,
  email TEXT,
  location TEXT,
  created_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  base_salary REAL NOT NULL DEFAULT 0,
  allowance REAL NOT NULL DEFAULT 0,
  bonus REAL NOT NULL DEFAULT 0,
  responsibilities TEXT,
  requirements TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT NOT NULL UNIQUE,
  department_id INTEGER,
  position_id INTEGER,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  birth_date TEXT,
  gender TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  hire_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vacations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  vacation_type TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  days_count INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  accrual_month TEXT NOT NULL,
  base_salary REAL NOT NULL DEFAULT 0,
  bonus REAL NOT NULL DEFAULT 0,
  allowance REAL NOT NULL DEFAULT 0,
  deductions REAL NOT NULL DEFAULT 0,
  taxes REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL DEFAULT 0,
  paid_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, accrual_month),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_position_id ON employees(position_id);
CREATE INDEX IF NOT EXISTS idx_vacations_employee_id ON vacations(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employee_id ON payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_accrual_month ON payroll(accrual_month);