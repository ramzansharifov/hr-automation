import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

const migrationsDirectory = path.resolve("electron/migrations");
const foreignKeysOffMarker = "-- requires_foreign_keys_off";

function createMigratedDatabase() {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");

  for (const fileName of readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(path.join(migrationsDirectory, fileName), "utf8");
    const disableForeignKeys = sql.includes(foreignKeysOffMarker);
    if (disableForeignKeys) database.pragma("foreign_keys = OFF");
    try {
      database.exec(sql);
      const violations = database.pragma("foreign_key_check");
      assert.deepEqual(violations, [], `foreign-key violations after ${fileName}`);
    } finally {
      if (disableForeignKeys) database.pragma("foreign_keys = ON");
    }
  }

  return database;
}

function seedOrganization(database) {
  const enterpriseId = Number(
    database
      .prepare("INSERT INTO enterprises (name) VALUES (?)")
      .run("HR Core Test Enterprise").lastInsertRowid,
  );
  const departmentId = Number(
    database
      .prepare(
        "INSERT INTO departments (enterprise_id, name) VALUES (?, ?)",
      )
      .run(enterpriseId, "Engineering").lastInsertRowid,
  );
  const positionId = Number(
    database
      .prepare("INSERT INTO positions (department_id, name) VALUES (?, ?)")
      .run(departmentId, "Frontend Developer").lastInsertRowid,
  );
  return { enterpriseId, departmentId, positionId };
}

function seedActiveEmployee(database, organization, suffix = "One") {
  return Number(
    database
      .prepare(
        `INSERT INTO employees (
           enterprise_id, department_id, position_id,
           last_name, first_name, hire_date, status, lifecycle_status,
           employment_started_at, salary
         ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'active', ?, 5000)`,
      )
      .run(
        organization.enterpriseId,
        organization.departmentId,
        organization.positionId,
        `Testov${suffix}`,
        "Employee",
        "2026-01-15",
        "2026-01-15",
      ).lastInsertRowid,
  );
}

test("fresh database exposes the expanded HR core schema and permissions", () => {
  const database = createMigratedDatabase();
  try {
    const requiredTables = [
      "leadership_history",
      "employee_documents",
      "work_calendar_days",
      "leave_balances",
      "data_exchange_runs",
    ];
    for (const tableName of requiredTables) {
      const found = database
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        )
        .get(tableName);
      assert.ok(found, `missing table ${tableName}`);
    }

    const employeeColumns = database
      .prepare("PRAGMA table_info(employees)")
      .all()
      .map((column) => column.name);
    for (const columnName of [
      "lifecycle_status",
      "employment_started_at",
      "registered_at",
    ]) {
      assert.ok(employeeColumns.includes(columnName), `missing employees.${columnName}`);
    }

    const permissionCodes = new Set(
      database
        .prepare(
          `SELECT code FROM permissions WHERE code IN (
             'documents.view', 'documents.add', 'documents.delete',
             'leave.view', 'leave.manage', 'leave.calendar_manage',
             'attention.view', 'analytics.view',
             'data_exchange.import', 'data_exchange.export'
           )`,
        )
        .all()
        .map((row) => row.code),
    );
    assert.equal(permissionCodes.size, 10);
  } finally {
    database.close();
  }
});

test("pending employee registration does not create a fake hire event", () => {
  const database = createMigratedDatabase();
  try {
    const { enterpriseId } = seedOrganization(database);
    const employeeId = Number(
      database
        .prepare(
          `INSERT INTO employees (
             enterprise_id, last_name, first_name, hire_date,
             status, lifecycle_status, employment_started_at
           ) VALUES (?, 'Pending', 'Employee', '2026-08-25',
                     'pending_assignment', 'pending_assignment', NULL)`,
        )
        .run(enterpriseId).lastInsertRowid,
    );

    const historyCount = Number(
      database
        .prepare("SELECT COUNT(*) FROM employment_history WHERE employee_id = ?")
        .pluck()
        .get(employeeId),
    );
    assert.equal(historyCount, 0);
  } finally {
    database.close();
  }
});

test("overlapping active vacations for one employee are rejected", () => {
  const database = createMigratedDatabase();
  try {
    const organization = seedOrganization(database);
    const employeeId = seedActiveEmployee(database, organization);
    const vacationTypeId = Number(
      database
        .prepare(
          `INSERT INTO vacation_types (
             enterprise_id, name, is_paid_default, is_active
           ) VALUES (?, 'Annual Test Leave', 1, 1)`,
        )
        .run(organization.enterpriseId).lastInsertRowid,
    );

    database
      .prepare(
        `INSERT INTO vacations (
           employee_id, vacation_type_id, starts_at, ends_at,
           days_count, working_days_count, is_paid, status
         ) VALUES (?, ?, '2026-09-01', '2026-09-10', 10, 8, 1, 'approved')`,
      )
      .run(employeeId, vacationTypeId);

    assert.throws(
      () =>
        database
          .prepare(
            `INSERT INTO vacations (
               employee_id, vacation_type_id, starts_at, ends_at,
               days_count, working_days_count, is_paid, status
             ) VALUES (?, ?, '2026-09-08', '2026-09-12', 5, 3, 1, 'planned')`,
          )
          .run(employeeId, vacationTypeId),
      /пересека|overlap/i,
    );
  } finally {
    database.close();
  }
});

test("used vacancies are archived while unused vacancies can be physically deleted", () => {
  const database = createMigratedDatabase();
  try {
    const organization = seedOrganization(database);
    const usedVacancyId = Number(
      database
        .prepare(
          `INSERT INTO vacancies (
             position_id, status, employment_type, openings_count
           ) VALUES (?, 'open', 'full_time', 1)`,
        )
        .run(organization.positionId).lastInsertRowid,
    );

    database
      .prepare(
        `INSERT INTO candidates (
           vacancy_id, last_name, first_name, status
         ) VALUES (?, 'Candidate', 'Used', 'new')`,
      )
      .run(usedVacancyId);

    database.prepare("DELETE FROM vacancies WHERE id = ?").run(usedVacancyId);

    const archived = database
      .prepare(
        "SELECT status, is_archived, archived_at FROM vacancies WHERE id = ?",
      )
      .get(usedVacancyId);
    assert.equal(archived.status, "closed");
    assert.equal(archived.is_archived, 1);
    assert.ok(archived.archived_at);
    assert.equal(
      Number(
        database
          .prepare("SELECT COUNT(*) FROM candidates WHERE vacancy_id = ?")
          .pluck()
          .get(usedVacancyId),
      ),
      1,
    );

    assert.throws(
      () =>
        database
          .prepare(
            `INSERT INTO candidates (
               vacancy_id, last_name, first_name, status
             ) VALUES (?, 'Candidate', 'Blocked', 'new')`,
          )
          .run(usedVacancyId),
      /архивную вакансию/i,
    );

    const unusedVacancyId = Number(
      database
        .prepare(
          `INSERT INTO vacancies (
             position_id, status, employment_type, openings_count
           ) VALUES (?, 'draft', 'full_time', 1)`,
        )
        .run(organization.positionId).lastInsertRowid,
    );
    database.prepare("DELETE FROM vacancies WHERE id = ?").run(unusedVacancyId);
    assert.equal(
      database.prepare("SELECT id FROM vacancies WHERE id = ?").get(unusedVacancyId),
      undefined,
    );
  } finally {
    database.close();
  }
});
