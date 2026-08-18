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
         EXISTS(SELECT 1 FROM vacations) AS has_data`,
    )
    .get() as { has_data: 0 | 1 };

  return result.has_data === 1;
}

function seedEnterprise(database: Database.Database): number {
  database
    .prepare(
      `INSERT OR IGNORE INTO enterprises (
         name, legal_name, legal_form, phone, email, address
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "Основное предприятие",
      "Основное предприятие",
      "ООО",
      "+992 900 00 00 00",
      "office@company.local",
      "г. Душанбе",
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
      name, enterprise_id, phone, email, location, created_on
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertDepartment.run(
    "Отдел кадров",
    enterpriseId,
    "+992 900 11 22 33",
    "hr@company.local",
    "Главный офис, кабинет 204",
    "2021-01-15",
  );

  insertDepartment.run(
    "Бухгалтерия",
    enterpriseId,
    "+992 900 44 55 66",
    "finance@company.local",
    "Главный офис, кабинет 112",
    "2020-03-10",
  );

  insertDepartment.run(
    "IT-отдел",
    enterpriseId,
    "+992 901 77 88 99",
    "it@company.local",
    "Главный офис, кабинет 310",
    "2022-05-01",
  );
}

function seedPositions(database: Database.Database): void {
  const insertPosition = database.prepare(`
    INSERT OR IGNORE INTO positions (name, department_id, responsibilities)
    VALUES (?, ?, ?)
  `);

  const departmentId = (name: string): number => {
    const record = database
      .prepare("SELECT id FROM departments WHERE name = ? LIMIT 1")
      .get(name) as { id: number };
    return record.id;
  };

  insertPosition.run(
    "HR-специалист",
    departmentId("Отдел кадров"),
    "Ведение личных дел, оформление отпусков и сопровождение подбора персонала",
  );
  insertPosition.run(
    "Бухгалтер",
    departmentId("Бухгалтерия"),
    "Ведение бухгалтерского учёта и финансовой отчётности",
  );
  insertPosition.run(
    "Системный администратор",
    departmentId("IT-отдел"),
    "Поддержка рабочих станций, серверов и внутренних систем",
  );
}

function seedEmployees(database: Database.Database): void {
  const insertEmployee = database.prepare(`
    INSERT OR IGNORE INTO employees (
      id, department_id, position_id, employee_number,
      last_name, first_name, middle_name, birth_date, gender,
      address, phone, email, hire_date, salary, status,
      employment_type, contract_number, contract_date, workplace
    ) VALUES (
      @id, @departmentId, @positionId, @employeeNumber,
      @lastName, @firstName, @middleName, @birthDate, @gender,
      @address, @phone, @email, @hireDate, @salary, 'active',
      'full_time', @contractNumber, @contractDate, @workplace
    )
  `);

  const assignment = (
    positionName: string,
  ): { departmentId: number; positionId: number } => {
    const record = database
      .prepare(
        `SELECT positions.id AS positionId,
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
    employeeNumber: "EMP-001",
    lastName: "Саидова",
    firstName: "Малика",
    middleName: "Алишеровна",
    birthDate: "1994-06-12",
    gender: "female",
    address: "г. Душанбе",
    phone: "+992 900 11 22 33",
    email: "malika.saidova@company.local",
    hireDate: "2021-02-01",
    salary: 4200,
    contractNumber: "TD-001",
    contractDate: "2021-02-01",
    workplace: "Главный офис",
  });

  insertEmployee.run({
    id: 2,
    departmentId: accountantAssignment.departmentId,
    positionId: accountantAssignment.positionId,
    employeeNumber: "EMP-002",
    lastName: "Каримов",
    firstName: "Фарид",
    middleName: "Насимович",
    birthDate: "1991-09-20",
    gender: "male",
    address: "г. Душанбе",
    phone: "+992 900 44 55 66",
    email: "farid.karimov@company.local",
    hireDate: "2020-04-10",
    salary: 5000,
    contractNumber: "TD-002",
    contractDate: "2020-04-10",
    workplace: "Главный офис",
  });

  insertEmployee.run({
    id: 3,
    departmentId: administratorAssignment.departmentId,
    positionId: administratorAssignment.positionId,
    employeeNumber: "EMP-003",
    lastName: "Рахмонов",
    firstName: "Азиз",
    middleName: "Шарифович",
    birthDate: "1996-01-28",
    gender: "male",
    address: "г. Душанбе",
    phone: "+992 901 77 88 99",
    email: "aziz.rahmonov@company.local",
    hireDate: "2022-05-15",
    salary: 6500,
    contractNumber: "TD-003",
    contractDate: "2022-05-15",
    workplace: "Главный офис",
  });
}

function seedVacations(database: Database.Database): void {
  const vacationTypeId = database
    .prepare("SELECT id FROM vacation_types WHERE name = ? LIMIT 1")
    .pluck()
    .get("Ежегодный отпуск") as number | undefined;

  if (!vacationTypeId) return;

  database
    .prepare(
      `INSERT OR IGNORE INTO vacations (
         employee_id, vacation_type_id, starts_at, ends_at, days_count,
         is_paid, reason, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      1,
      vacationTypeId,
      "2026-08-01",
      "2026-08-14",
      14,
      1,
      "Плановый отпуск",
      "planned",
    );
}
