import type Database from "better-sqlite3";

export function seedDatabase(database: Database.Database): void {
  if (hasBusinessData(database)) {
    return;
  }

  const transaction = database.transaction(() => {
    const enterpriseId = seedEnterprise(database);
    seedDepartments(database, enterpriseId);
    seedPositions(database);
    seedEmployees(database);
    seedVacations(database);
    seedPayroll(database);
  });

  transaction();
}

function hasBusinessData(database: Database.Database): boolean {
  const result = database
    .prepare(
      `SELECT
         EXISTS(SELECT 1 FROM enterprises) OR
         EXISTS(SELECT 1 FROM departments) OR
         EXISTS(SELECT 1 FROM positions) OR
         EXISTS(SELECT 1 FROM employees) OR
         EXISTS(SELECT 1 FROM vacations) OR
         EXISTS(SELECT 1 FROM payroll) AS has_data`,
    )
    .get() as { has_data: 0 | 1 };

  return result.has_data === 1;
}

function seedEnterprise(database: Database.Database): number {
  database
    .prepare(
      `INSERT OR IGNORE INTO enterprises (name, legal_name, phone, email, address, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "Основное предприятие",
      "ООО «Основное предприятие»",
      "+992 900 00 00 00",
      "office@company.local",
      "г. Душанбе",
      "Демонстрационное предприятие",
    );

  const record = database
    .prepare("SELECT id FROM enterprises WHERE name = ? LIMIT 1")
    .get("Основное предприятие") as { id: number };

  return record.id;
}

function seedDepartments(
  database: Database.Database,
  enterpriseId: number,
): void {
  const insertDepartment = database.prepare(`
    INSERT OR IGNORE INTO departments (
      name,
      enterprise_id,
      manager_name,
      phone,
      email,
      location,
      created_on,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertDepartment.run(
    "Отдел кадров",
    enterpriseId,
    "Саидова Малика",
    "+992 900 11 22 33",
    "hr@company.local",
    "Главный офис, кабинет 204",
    "2021-01-15",
    "Основной отдел по работе с персоналом",
  );

  insertDepartment.run(
    "Бухгалтерия",
    enterpriseId,
    "Каримов Фарид",
    "+992 900 44 55 66",
    "finance@company.local",
    "Главный офис, кабинет 112",
    "2020-03-10",
    "Начисление заработной платы и отчётность",
  );

  insertDepartment.run(
    "IT-отдел",
    enterpriseId,
    "Рахмонов Азиз",
    "+992 901 77 88 99",
    "it@company.local",
    "Главный офис, кабинет 310",
    "2022-05-01",
    "Техническая поддержка и автоматизация",
  );
}

function seedPositions(database: Database.Database): void {
  const insertPosition = database.prepare(`
    INSERT OR IGNORE INTO positions (
      name,
      department_id,
      base_salary,
      allowance,
      bonus,
      responsibilities,
      requirements,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const departmentId = (name: string): number => {
    const record = database
      .prepare("SELECT id FROM departments WHERE name = ? LIMIT 1")
      .get(name) as {
      id: number;
    };
    return record.id;
  };

  insertPosition.run(
    "HR-специалист",
    departmentId("Отдел кадров"),
    4200,
    300,
    500,
    "Ведение личных дел, оформление отпусков, подбор персонала",
    "Опыт работы с кадровыми документами, внимательность",
    "Базовая должность отдела кадров",
  );

  insertPosition.run(
    "Бухгалтер",
    departmentId("Бухгалтерия"),
    5000,
    500,
    700,
    "Начисление зарплаты, налоги, финансовая отчётность",
    "Знание бухгалтерского учёта и налогов",
    "Должность бухгалтерии",
  );

  insertPosition.run(
    "Системный администратор",
    departmentId("IT-отдел"),
    6500,
    800,
    1000,
    "Поддержка рабочих станций, серверов и внутренних систем",
    "Опыт администрирования Windows/Linux, сети, безопасность",
    "Техническая должность",
  );
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
  `);

  const assignment = (
    positionName: string,
  ): { departmentId: number; positionId: number } => {
    const record = database
      .prepare(
        `SELECT
           positions.id AS positionId,
           positions.department_id AS departmentId
         FROM positions
         WHERE positions.name = ?
         LIMIT 1`,
      )
      .get(positionName) as
      | { departmentId: number; positionId: number }
      | undefined;

    if (!record || record.departmentId === null) {
      throw new Error(
        `Не удалось определить отдел для демонстрационной должности «${positionName}»`,
      );
    }

    return record;
  };

  const hrAssignment = assignment("HR-специалист");
  const accountantAssignment = assignment("Бухгалтер");
  const administratorAssignment = assignment("Системный администратор");

  insertEmployee.run({
    id: 1,
    departmentId: hrAssignment.departmentId,
    positionId: hrAssignment.positionId,
    lastName: "Саидова",
    firstName: "Малика",
    middleName: "Алишеровна",
    birthDate: "1994-06-12",
    gender: "female",
    address: "г. Душанбе",
    phone: "+992 900 11 22 33",
    email: "malika.saidova@company.local",
    hireDate: "2021-02-01",
    status: "active",
    note: "Руководитель HR-процессов",
  });

  insertEmployee.run({
    id: 2,
    departmentId: accountantAssignment.departmentId,
    positionId: accountantAssignment.positionId,
    lastName: "Каримов",
    firstName: "Фарид",
    middleName: "Насимович",
    birthDate: "1991-09-20",
    gender: "male",
    address: "г. Душанбе",
    phone: "+992 900 44 55 66",
    email: "farid.karimov@company.local",
    hireDate: "2020-04-10",
    status: "active",
    note: "Ответственный за начисления",
  });

  insertEmployee.run({
    id: 3,
    departmentId: administratorAssignment.departmentId,
    positionId: administratorAssignment.positionId,
    lastName: "Рахмонов",
    firstName: "Азиз",
    middleName: "Шарифович",
    birthDate: "1996-01-28",
    gender: "male",
    address: "г. Душанбе",
    phone: "+992 901 77 88 99",
    email: "aziz.rahmonov@company.local",
    hireDate: "2022-05-15",
    status: "active",
    note: "Администрирование системы",
  });
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
  `);

  insertVacation.run(
    1,
    "Ежегодный отпуск",
    "2026-08-01",
    "2026-08-14",
    14,
    "Плановый отпуск",
    "planned",
    "Демо-запись",
  );
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
  `);

  insertPayroll.run(
    1,
    "2026-07",
    4200,
    500,
    300,
    0,
    250,
    4750,
    "2026-07-30",
    "Демо-начисление",
  );
  insertPayroll.run(
    2,
    "2026-07",
    5000,
    700,
    500,
    100,
    350,
    5750,
    "2026-07-30",
    "Демо-начисление",
  );
  insertPayroll.run(
    3,
    "2026-07",
    6500,
    1000,
    800,
    0,
    500,
    7800,
    "2026-07-30",
    "Демо-начисление",
  );
}
