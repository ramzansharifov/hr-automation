CREATE TABLE IF NOT EXISTS employee_education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  education_type TEXT NOT NULL,
  education_degree TEXT,
  institution_name TEXT NOT NULL,
  speciality TEXT,
  started_at TEXT,
  ended_at TEXT,
  document_number TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_experience (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  company_name TEXT NOT NULL,
  position_name TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  responsibilities TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employee_education_employee_id ON employee_education(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_experience_employee_id ON employee_experience(employee_id);

