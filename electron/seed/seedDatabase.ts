import type Database from 'better-sqlite3'

export function seedDatabase(database: Database.Database): void {
  const transaction = database.transaction(() => {
    seedDepartments(database)
    seedPositions(database)
    seedEmployees(database)
    seedVacations(database)
    seedPayroll(database)
  })

  transaction()
}

function seedDepartments(database: Database.Database): void {
  const insertDepartment = database.prepare(`
    INSERT OR IGNORE INTO departments (
      name,
      manager_name,
      phone,
      email,
      location,
      created_on,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  insertDepartment.run(
    'Отдел кадров',
    'Саидова Малика',
    '+992 900 11 22 33',
    'hr@company.local',
    'Главный офис, кабинет 204',
    '2021-01-15',
    'Основной отдел по работе с персоналом',
  )

  insertDepartment.run(
    'Бухгалтерия',
    'Каримов Фарид',
    '+992 900 44 55 66',
    'finance@company.local',
    'Главный офис, кабинет 112',
    '2020-03-10',
    'Начисление заработной платы и отчётность',
  )

  insertDepartment.run(
    'IT-отдел',
    'Рахмонов Азиз',
    '+992 901 77 88 99',
    'it@company.local',
    'Главный офис, кабинет 310',
    '2022-05-01',
    'Техническая поддержка и автоматизация',
  )
}

function seedPositions(database: Database.Database): void {
  const insertPosition = database.prepare(`
    INSERT OR IGNORE INTO positions (
      name,
      base_salary,
      allowance,
      bonus,
      responsibilities,
      requirements,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  insertPosition.run(
    'HR-специалист',
    4200,
    300,
    500,
    'Ведение личных дел, оформление отпусков, подбор персонала',
    'Опыт работы с кадровыми документами, внимательность',
    'Базовая должность отдела кадров',
  )

  insertPosition.run(
    'Бухгалтер',
    5000,
    500,
    700,
    'Начисление зарплаты, налоги, финансовая отчётность',
    'Знание бухгалтерского учёта и налогов',
    'Должность бухгалтерии',
  )

  insertPosition.run(
    'Системный администратор',
    6500,
    800,
    1000,
    'Поддержка рабочих станций, серверов и внутренних систем',
    'Опыт администрирования Windows/Linux, сети, безопасность',
    'Техническая должность',
  )
}

function seedEmployees(database: Database.Database): void {
  const insertEmployee = database.prepare(`
    INSERT OR IGNORE INTO employees (
      id,
      department_id,
      position_id,
      last_name,
      first_name,
      middle_name,
      birth_date,
      gender,
      address,
      phone,
      email,
      hire_date,
      status,
      note
    )
    VALUES (
      @id,
      @departmentId,
      @positionId,
      @lastName,
      @firstName,
      @middleName,
      @birthDate,
      @gender,
      @address,
      @phone,
      @email,
      @hireDate,
      @status,
      @note
    )
  `)

  insertEmployee.run({
    id: 1,
    departmentId: 1,
    positionId: 1,
    lastName: 'Саидова',
    firstName: 'Малика',
    middleName: 'Алишеровна',
    birthDate: '1994-06-12',
    gender: 'female',
    address: 'г. Душанбе',
    phone: '+992 900 11 22 33',
    email: 'malika.saidova@company.local',
    hireDate: '2021-02-01',
    status: 'active',
    note: 'Руководитель HR-процессов',
  })

  insertEmployee.run({
    id: 2,
    departmentId: 2,
    positionId: 2,
    lastName: 'Каримов',
    firstName: 'Фарид',
    middleName: 'Насимович',
    birthDate: '1991-09-20',
    gender: 'male',
    address: 'г. Душанбе',
    phone: '+992 900 44 55 66',
    email: 'farid.karimov@company.local',
    hireDate: '2020-04-10',
    status: 'active',
    note: 'Ответственный за начисления',
  })

  insertEmployee.run({
    id: 3,
    departmentId: 3,
    positionId: 3,
    lastName: 'Рахмонов',
    firstName: 'Азиз',
    middleName: 'Шарифович',
    birthDate: '1996-01-28',
    gender: 'male',
    address: 'г. Душанбе',
    phone: '+992 901 77 88 99',
    email: 'aziz.rahmonov@company.local',
    hireDate: '2022-05-15',
    status: 'active',
    note: 'Администрирование системы',
  })
}

function seedVacations(database: Database.Database): void {
  const insertVacation = database.prepare(`
    INSERT OR IGNORE INTO vacations (
      employee_id,
      vacation_type,
      starts_at,
      ends_at,
      days_count,
      reason,
      status,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertVacation.run(
    1,
    'Ежегодный отпуск',
    '2026-08-01',
    '2026-08-14',
    14,
    'Плановый отпуск',
    'planned',
    'Демо-запись',
  )
}

function seedPayroll(database: Database.Database): void {
  const insertPayroll = database.prepare(`
    INSERT OR IGNORE INTO payroll (
      employee_id,
      accrual_month,
      base_salary,
      bonus,
      allowance,
      deductions,
      taxes,
      net_amount,
      paid_at,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertPayroll.run(1, '2026-07', 4200, 500, 300, 0, 250, 4750, '2026-07-30', 'Демо-начисление')
  insertPayroll.run(2, '2026-07', 5000, 700, 500, 100, 350, 5750, '2026-07-30', 'Демо-начисление')
  insertPayroll.run(3, '2026-07', 6500, 1000, 800, 0, 500, 7800, '2026-07-30', 'Демо-начисление')
}
