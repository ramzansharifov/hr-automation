import Database from "better-sqlite3";
import { app } from "electron";
import { createHash, scryptSync } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const VERIFY_MODE = process.argv.includes("--verify");
const DEMO_PASSWORD = "Demo2026!";
const FOREIGN_KEYS_OFF_MARKER = "-- requires_foreign_keys_off";

function userDataCandidates() {
  const home = os.homedir();
  if (process.platform === "win32") {
    const root = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return [path.join(root, "hr-automation"), path.join(root, "HR Automation")];
  }
  if (process.platform === "darwin") {
    const root = path.join(home, "Library", "Application Support");
    return [path.join(root, "hr-automation"), path.join(root, "HR Automation")];
  }
  const root = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return [path.join(root, "hr-automation"), path.join(root, "HR Automation")];
}

function resolveLiveDatabase() {
  if (process.env.HR_DB_PATH) {
    const databasePath = path.resolve(process.env.HR_DB_PATH);
    return { databasePath, userDataRoot: path.dirname(path.dirname(databasePath)) };
  }

  for (const userDataRoot of userDataCandidates()) {
    const databasePath = path.join(userDataRoot, "database", "hr-automation.sqlite");
    if (existsSync(databasePath)) return { databasePath, userDataRoot };
  }

  throw new Error(
    "Локальная база HR Automation не найдена. Запустите приложение один раз, полностью закройте его и повторите команду.",
  );
}

function applyMigrations(database) {
  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "name TEXT NOT NULL UNIQUE," +
      "applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP" +
    ");",
  );

  const migrationsDirectory = path.resolve("electron", "migrations");
  const files = readdirSync(migrationsDirectory)
    .filter(function (name) { return name.endsWith(".sql"); })
    .sort();

  for (const fileName of files) {
    const alreadyApplied = database
      .prepare("SELECT 1 FROM schema_migrations WHERE name = ? LIMIT 1")
      .get(fileName);
    if (alreadyApplied) continue;

    const sql = readFileSync(path.join(migrationsDirectory, fileName), "utf8");
    const needsForeignKeysOff = sql.includes(FOREIGN_KEYS_OFF_MARKER);
    if (needsForeignKeysOff) database.pragma("foreign_keys = OFF");

    try {
      const transaction = database.transaction(function () {
        database.exec(sql);
        database
          .prepare("INSERT INTO schema_migrations (name) VALUES (?)")
          .run(fileName);
      });
      transaction();

      if (needsForeignKeysOff) {
        const errors = database.pragma("foreign_key_check");
        if (errors.length > 0) {
          throw new Error(
            "Foreign key check failed after " + fileName + ": " +
              JSON.stringify(errors.slice(0, 5)),
          );
        }
      }
    } finally {
      if (needsForeignKeysOff) database.pragma("foreign_keys = ON");
    }
  }
}

function assertClean(database) {
  const tables = [
    "enterprises",
    "departments",
    "positions",
    "employees",
    "vacations",
    "vacancies",
    "candidates",
    "employee_documents",
    "data_exchange_runs",
  ];

  for (const table of tables) {
    const count = Number(
      database.prepare("SELECT COUNT(*) FROM " + table).pluck().get() || 0,
    );
    if (count > 0) {
      throw new Error(
        "База не пустая: таблица " + table + " содержит " + count +
          " записей. Выполните npm run db:reset, запустите приложение для создания схемы, закройте его и повторите seed.",
      );
    }
  }
}

function passwordCredentials(username) {
  const salt = createHash("sha256")
    .update("hr-demo:" + username)
    .digest("hex")
    .slice(0, 32);
  const hash = scryptSync(DEMO_PASSWORD, salt, 64).toString("hex");
  return { salt, hash };
}

function insertUsersAndAccess(database) {
  const users = [
    [1, "rustam.director"],
    [26, "bahrom.director"],
    [38, "shahlo.director"],
    [3, "malika.hr"],
    [6, "kamol.it"],
    [5, "dilshod.recruiter"],
    [14, "shoira.finance"],
    [27, "nasiba.service"],
    [39, "munira.admin"],
    [8, "sukhrob.employee"],
  ];

  const insertUser = database.prepare(
    "INSERT INTO users (" +
      "employee_id, username, password_hash, password_salt, status, " +
      "must_change_password, lifecycle_blocked, created_at, updated_at" +
    ") VALUES (?, ?, ?, ?, 'active', 0, 0, '2026-06-22 09:00:00', '2026-06-22 09:00:00')",
  );
  const employeeRoleId = Number(
    database.prepare("SELECT id FROM roles WHERE system_key = 'employee'").pluck().get(),
  );

  const userByEmployee = new Map();
  for (const item of users) {
    const employeeId = item[0];
    const username = item[1];
    const credentials = passwordCredentials(username);
    const userId = Number(
      insertUser.run(employeeId, username, credentials.hash, credentials.salt).lastInsertRowid,
    );
    userByEmployee.set(employeeId, userId);
    database
      .prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)")
      .run(userId, employeeRoleId);
  }

  function assignSystemRole(employeeId, systemKey) {
    const roleId = Number(
      database
        .prepare("SELECT id FROM roles WHERE system_key = ?")
        .pluck()
        .get(systemKey),
    );
    database
      .prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)")
      .run(userByEmployee.get(employeeId), roleId);
  }

  assignSystemRole(3, "enterprise_admin");
  assignSystemRole(6, "department_admin");

  const leaderTransaction = database.transaction(function () {
    database.prepare("UPDATE enterprises SET general_director_employee_id=1 WHERE id=1").run();
    database.prepare("UPDATE enterprises SET general_director_employee_id=26 WHERE id=2").run();
    database.prepare("UPDATE enterprises SET general_director_employee_id=38 WHERE id=3").run();

    const departmentLeaders = [
      [1, 2],
      [2, 3],
      [3, 6],
      [4, 12],
      [5, 15],
      [6, 18],
      [7, 27],
      [8, 30],
      [9, 34],
      [10, 39],
      [11, 40],
      [12, 43],
    ];
    const updateDepartment = database.prepare(
      "UPDATE departments SET director_employee_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    );
    for (const item of departmentLeaders) {
      updateDepartment.run(item[1], item[0]);
    }
  });
  leaderTransaction();

  const assignCustomRole = database.prepare(
    "INSERT INTO user_roles (user_id, role_id) " +
    "SELECT ?, id FROM roles WHERE code=?",
  );
  assignCustomRole.run(userByEmployee.get(5), "pamir_recruiter_demo");
  assignCustomRole.run(userByEmployee.get(27), "somon_hr_viewer_demo");
  assignCustomRole.run(userByEmployee.get(14), "pamir_finance_docs_demo");
  assignCustomRole.run(userByEmployee.get(39), "rudaki_recruiter_demo");

  const leadershipRows = [
    ["enterprise",1,"assign",null,1,"unassigned","2021-01-12","Назначение генерального директора"],
    ["enterprise",2,"assign",null,26,"unassigned","2019-04-08","Назначение генерального директора"],
    ["enterprise",3,"assign",null,38,"unassigned","2020-06-15","Назначение генерального директора"],
    ["department",2,"replace",4,3,"keep_assignment","2025-01-13","Плановая смена руководителя отдела кадров"],
    ["department",3,"assign",null,6,"unassigned","2023-06-01","Назначение руководителя IT"],
    ["department",4,"assign",null,12,"unassigned","2022-01-10","Назначение финансового директора"],
    ["department",5,"assign",null,15,"unassigned","2022-03-01","Назначение руководителя маркетинга"],
    ["department",6,"assign",null,18,"unassigned","2021-01-11","Назначение руководителя продаж"],
    ["department",8,"assign",null,30,"unassigned","2020-01-13","Назначение руководителя логистики"],
    ["department",9,"assign",null,34,"unassigned","2020-05-04","Назначение начальника склада"],
    ["department",11,"assign",null,40,"unassigned","2020-07-01","Назначение директора магазина"],
    ["department",12,"assign",null,43,"unassigned","2021-01-11","Назначение руководителя закупок"],
  ];
  const insertLeadership = database.prepare(
    "INSERT INTO leadership_history (" +
      "target_type,target_id,action,previous_leader_employee_id,new_leader_employee_id," +
      "previous_leader_outcome,effective_at,reason,created_at" +
    ") VALUES (?,?,?,?,?,?,?,?,?)",
  );
  for (const row of leadershipRows) {
    insertLeadership.run(
      row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7],
      row[6] + " 08:30:00",
    );
  }
}

function createDocuments(database, userDataRoot) {
  const specs = [
    [3,"Трудовой договор","Трудовой договор TD-003/26","2021-02-01",null],
    [3,"Приказ","Приказ о назначении руководителем отдела кадров","2025-01-13",null],
    [6,"Трудовой договор","Трудовой договор руководителя IT","2020-10-12",null],
    [7,"Диплом / образование","Диплом о высшем образовании","2018-06-30",null],
    [8,"Справка / сертификат","Сертификат React Advanced","2026-04-12","2026-10-05"],
    [10,"Справка / сертификат","Сертификат по тестированию","2025-09-28","2026-09-28"],
    [12,"Трудовой договор","Трудовой договор финансового директора","2020-04-10",null],
    [14,"Справка / сертификат","Сертификат финансового аналитика","2026-01-15","2026-10-15"],
    [15,"Приказ","Приказ о назначении руководителем маркетинга","2022-03-01",null],
    [18,"Трудовой договор","Трудовой договор руководителя продаж","2020-08-17",null],
    [23,"Удостоверение личности / паспорт","Копия удостоверения личности","2026-03-16","2031-03-16"],
    [24,"Приказ","Приказ о повторном приёме","2025-08-18",null],
    [26,"Трудовой договор","Трудовой договор генерального директора","2019-04-08",null],
    [27,"Справка / сертификат","Сертификат клиентского сервиса","2026-02-01","2026-10-01"],
    [30,"Приказ","Приказ о назначении руководителем логистики","2020-01-13",null],
    [34,"Справка / сертификат","Сертификат складской безопасности","2026-03-10","2027-03-10"],
    [38,"Трудовой договор","Трудовой договор генерального директора","2020-06-15",null],
    [40,"Приказ","Приказ о назначении директором магазина","2020-07-01",null],
    [41,"Удостоверение личности / паспорт","Копия паспорта","2026-02-09","2030-12-31"],
    [44,"Справка / сертификат","Сертификат по закупкам","2026-06-01","2026-09-25"],
  ];

  const root = path.join(userDataRoot, "employee-documents");
  mkdirSync(root, { recursive: true });

  const insert = database.prepare(
    "INSERT INTO employee_documents (" +
      "employee_id,employment_history_id,document_type_id,document_type,title," +
      "original_name,stored_name,relative_path,mime_type,size_bytes,sha256," +
      "issued_at,expires_at,status,created_at,updated_at" +
    ") VALUES (?,?,?,?,?,?,?,?, 'text/plain',?,?,?,?, 'active',?,?)",
  );

  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const employeeId = spec[0];
    const typeName = spec[1];
    const title = spec[2];
    const issuedAt = spec[3];
    const expiresAt = spec[4];
    const employee = database
      .prepare(
        "SELECT enterprise_id,last_name,first_name FROM employees WHERE id=?",
      )
      .get(employeeId);
    const typeId = Number(
      database
        .prepare(
          "SELECT id FROM document_types WHERE enterprise_id=? AND name=?",
        )
        .pluck()
        .get(employee.enterprise_id, typeName),
    );
    const historyId = database
      .prepare(
        "SELECT id FROM employment_history WHERE employee_id=? ORDER BY effective_at,id LIMIT 1",
      )
      .pluck()
      .get(employeeId);

    const directory = path.join(root, String(employeeId));
    mkdirSync(directory, { recursive: true });
    const storedName =
      "presentation-" + String(index + 1).padStart(2, "0") + ".txt";
    const absolutePath = path.join(directory, storedName);
    const body = [
      "HR Automation — демонстрационный кадровый документ",
      "Сотрудник: " + employee.last_name + " " + employee.first_name,
      "Тип: " + typeName,
      "Название: " + title,
      "Дата выдачи: " + issuedAt,
      expiresAt ? "Срок действия: " + expiresAt : "Срок действия: бессрочно",
      "",
      "Файл создан автоматически только для демонстрации возможностей приложения.",
    ].join("\n");
    writeFileSync(absolutePath, body, "utf8");

    const relativePath = path
      .relative(root, absolutePath)
      .split(path.sep)
      .join("/");
    const sha256 = createHash("sha256").update(body).digest("hex");
    const createdAt =
      (issuedAt > "2026-01-01" ? issuedAt : "2026-06-22") + " 14:00:00";

    insert.run(
      employeeId,
      historyId || null,
      typeId,
      typeName,
      title,
      storedName,
      storedName,
      relativePath,
      Buffer.byteLength(body, "utf8"),
      sha256,
      issuedAt,
      expiresAt,
      createdAt,
      createdAt,
    );
  }
}

function validateSeed(database) {
  const checks = {
    enterprises: Number(database.prepare("SELECT COUNT(*) FROM enterprises").pluck().get()),
    departments: Number(database.prepare("SELECT COUNT(*) FROM departments").pluck().get()),
    positions: Number(database.prepare("SELECT COUNT(*) FROM positions").pluck().get()),
    employees: Number(database.prepare("SELECT COUNT(*) FROM employees").pluck().get()),
    histories: Number(database.prepare("SELECT COUNT(*) FROM employment_history").pluck().get()),
    vacations: Number(database.prepare("SELECT COUNT(*) FROM vacations").pluck().get()),
    documents: Number(database.prepare("SELECT COUNT(*) FROM employee_documents").pluck().get()),
    vacancies: Number(database.prepare("SELECT COUNT(*) FROM vacancies").pluck().get()),
    candidates: Number(database.prepare("SELECT COUNT(*) FROM candidates").pluck().get()),
    users: Number(database.prepare("SELECT COUNT(*) FROM users").pluck().get()),
    customRoles: Number(database.prepare("SELECT COUNT(*) FROM roles WHERE is_system=0").pluck().get()),
    audit: Number(database.prepare("SELECT COUNT(*) FROM audit_events").pluck().get()),
    exchangeRuns: Number(database.prepare("SELECT COUNT(*) FROM data_exchange_runs").pluck().get()),
    hiredCandidates: Number(
      database
        .prepare(
          "SELECT COUNT(*) FROM candidates WHERE status='hired' AND employee_id IS NOT NULL",
        )
        .pluck()
        .get(),
    ),
  };

  const expected = {
    enterprises: 3,
    departments: 12,
    positions: 37,
    employees: 45,
    vacations: 25,
    documents: 20,
    vacancies: 10,
    candidates: 35,
    users: 10,
    customRoles: 4,
    audit: 72,
    exchangeRuns: 9,
    hiredCandidates: 4,
  };

  for (const key of Object.keys(expected)) {
    if (checks[key] !== expected[key]) {
      throw new Error(
        "Presentation seed validation failed for " + key +
          ": expected " + expected[key] + ", got " + checks[key],
      );
    }
  }

  if (checks.histories < 60) {
    throw new Error(
      "Presentation seed expected at least 60 employment history rows, got " +
        checks.histories,
    );
  }

  const incompleteSnapshots = Number(
    database
      .prepare(
        "SELECT " +
          "(SELECT COUNT(*) FROM vacations WHERE enterprise_id_snapshot IS NULL OR department_id_snapshot IS NULL) + " +
          "(SELECT COUNT(*) FROM employee_documents WHERE enterprise_id_snapshot IS NULL OR department_id_snapshot IS NULL)",
      )
      .pluck()
      .get(),
  );
  if (incompleteSnapshots !== 0) {
    throw new Error(
      "Historical snapshot validation failed: " +
        incompleteSnapshots + " rows are incomplete",
    );
  }

  const fkErrors = database.pragma("foreign_key_check");
  if (fkErrors.length > 0) {
    throw new Error(
      "Foreign key check failed: " + JSON.stringify(fkErrors.slice(0, 10)),
    );
  }

  return checks;
}

function seedDatabase(database, userDataRoot) {
  assertClean(database);
  const sql = readFileSync(
    path.resolve("scripts", "presentation-seed.sql"),
    "utf8",
  );

  const transaction = database.transaction(function () {
    database.exec(sql);
    insertUsersAndAccess(database);
    createDocuments(database, userDataRoot);
  });
  transaction();

  return validateSeed(database);
}

function createBackups(databasePath, userDataRoot) {
  const directory = path.join(userDataRoot, "backups");
  mkdirSync(directory, { recursive: true });
  const specs = [
    ["hr-automation-2026-09-10T17-30-00.sqlite", "2026-09-10T17:30:00Z"],
    ["hr-automation-2026-09-14T12-30-00.sqlite", "2026-09-14T12:30:00Z"],
    ["hr-automation-2026-09-16T18-00-00.sqlite", "2026-09-16T18:00:00Z"],
  ];
  for (const spec of specs) {
    const destination = path.join(directory, spec[0]);
    copyFileSync(databasePath, destination);
    const stamp = new Date(spec[1]);
    utimesSync(destination, stamp, stamp);
  }
}

function runVerification() {
  const root = path.join(
    os.tmpdir(),
    "hr-automation-presentation-seed-" + process.pid,
  );
  const databaseDirectory = path.join(root, "database");
  mkdirSync(databaseDirectory, { recursive: true });
  const databasePath = path.join(databaseDirectory, "hr-automation.sqlite");
  const database = new Database(databasePath);

  try {
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
    applyMigrations(database);
    const checks = seedDatabase(database, root);
    database.pragma("wal_checkpoint(TRUNCATE)");
    console.log("Presentation seed verification passed:");
    console.log(checks);
  } finally {
    database.close();
    rmSync(root, { recursive: true, force: true });
  }
}

function runLiveSeed() {
  const resolved = resolveLiveDatabase();
  const database = new Database(resolved.databasePath);
  let isClosed = false;

  try {
    database.pragma("busy_timeout = 1500");
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");

    const migrationCount = Number(
      database
        .prepare("SELECT COUNT(*) FROM schema_migrations")
        .pluck()
        .get() || 0,
    );
    if (migrationCount < 39) {
      throw new Error(
        "В базе применено только " + migrationCount +
          " миграций. Запустите актуальную версию HR Automation и закройте её перед заполнением.",
      );
    }

    console.log("База: " + resolved.databasePath);
    console.log("Добавляю презентационный набор данных...");
    const checks = seedDatabase(database, resolved.userDataRoot);

    database.pragma("wal_checkpoint(TRUNCATE)");
    database.close();
    isClosed = true;
    createBackups(resolved.databasePath, resolved.userDataRoot);

    console.log("");
    console.log("Готово. Презентационная база заполнена:");
    for (const key of Object.keys(checks)) {
      console.log("  " + key + ": " + checks[key]);
    }

    console.log("");
    console.log("Пароль всех демонстрационных пользователей: " + DEMO_PASSWORD);
    console.log("Примеры логинов:");
    console.log("  malika.hr         — администратор Pamir Digital");
    console.log("  kamol.it          — администратор IT-отдела");
    console.log("  dilshod.recruiter — пользовательская роль рекрутера");
    console.log("  sukhrob.employee  — обычный сотрудник");
    console.log("");
    console.log("Теперь можно запускать npm run dev.");
  } catch (error) {
    if (!isClosed) {
      try {
        database.close();
      } catch {
        // Ignore close errors.
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/busy|locked|EBUSY/i.test(message)) {
      console.error(
        "База занята. Полностью закройте HR Automation и процессы Electron, затем повторите команду.",
      );
    }
    throw error;
  }
}

async function main() {
  await app.whenReady();

  try {
    if (VERIFY_MODE) {
      runVerification();
    } else {
      runLiveSeed();
    }
  } finally {
    app.quit();
  }
}

main().catch(function (error) {
  console.error(error);
  app.exit(1);
});
