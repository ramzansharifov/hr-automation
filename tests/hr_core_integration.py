import glob
import os
import sqlite3
import unittest

MARKER = "-- requires_foreign_keys_off"
MIGRATION_PATHS = sorted(glob.glob("electron/migrations/*.sql"))


def create_database():
    connection = sqlite3.connect(":memory:")
    connection.execute("PRAGMA foreign_keys = ON")
    for migration_path in MIGRATION_PATHS:
        with open(migration_path, "r", encoding="utf-8") as migration_file:
            sql = migration_file.read()
        needs_fk_off = MARKER in sql
        if needs_fk_off:
            connection.execute("PRAGMA foreign_keys = OFF")
        try:
            connection.executescript(sql)
            violations = connection.execute("PRAGMA foreign_key_check").fetchall()
            if violations:
                raise AssertionError(
                    f"Foreign key violations after {migration_path}: {violations}"
                )
        finally:
            if needs_fk_off:
                connection.execute("PRAGMA foreign_keys = ON")
    return connection


def seed_organization(connection):
    enterprise_id = connection.execute(
        "INSERT INTO enterprises (name) VALUES (?)", ("HR Core Test Enterprise",)
    ).lastrowid
    department_id = connection.execute(
        "INSERT INTO departments (enterprise_id, name) VALUES (?, ?)",
        (enterprise_id, "Engineering"),
    ).lastrowid
    position_id = connection.execute(
        "INSERT INTO positions (department_id, name) VALUES (?, ?)",
        (department_id, "Frontend Developer"),
    ).lastrowid
    return enterprise_id, department_id, position_id


def seed_active_employee(connection, organization):
    enterprise_id, department_id, position_id = organization
    return connection.execute(
        """
        INSERT INTO employees (
          enterprise_id, department_id, position_id,
          last_name, first_name, hire_date, status, lifecycle_status,
          employment_started_at, salary
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'active', ?, 5000)
        """,
        (
            enterprise_id,
            department_id,
            position_id,
            "Testov",
            "Employee",
            "2026-01-15",
            "2026-01-15",
        ),
    ).lastrowid


class HrCoreIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.connection = create_database()

    def tearDown(self):
        self.connection.close()

    def test_expanded_schema_and_permissions_exist(self):
        required_tables = {
            "leadership_history",
            "employee_documents",
            "work_calendar_days",
            "leave_balances",
            "data_exchange_runs",
        }
        actual_tables = {
            row[0]
            for row in self.connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        self.assertTrue(required_tables.issubset(actual_tables))

        employee_columns = {
            row[1]
            for row in self.connection.execute("PRAGMA table_info(employees)").fetchall()
        }
        self.assertTrue(
            {"lifecycle_status", "employment_started_at", "registered_at"}.issubset(
                employee_columns
            )
        )

        permission_codes = {
            row[0]
            for row in self.connection.execute(
                """
                SELECT code FROM permissions WHERE code IN (
                  'documents.view', 'documents.add', 'documents.delete',
                  'leave.view', 'leave.manage', 'leave.calendar_manage',
                  'attention.view', 'analytics.view',
                  'data_exchange.import', 'data_exchange.export'
                )
                """
            ).fetchall()
        }
        self.assertEqual(len(permission_codes), 10)

    def test_pending_employee_has_no_fake_hire_history(self):
        enterprise_id, _, _ = seed_organization(self.connection)
        employee_id = self.connection.execute(
            """
            INSERT INTO employees (
              enterprise_id, last_name, first_name, hire_date,
              status, lifecycle_status, employment_started_at
            ) VALUES (?, 'Pending', 'Employee', '2026-08-25',
                      'pending_assignment', 'pending_assignment', NULL)
            """,
            (enterprise_id,),
        ).lastrowid

        history_count = self.connection.execute(
            "SELECT COUNT(*) FROM employment_history WHERE employee_id = ?",
            (employee_id,),
        ).fetchone()[0]
        self.assertEqual(history_count, 0)

    def test_overlapping_active_vacations_are_rejected(self):
        organization = seed_organization(self.connection)
        employee_id = seed_active_employee(self.connection, organization)
        vacation_type_id = self.connection.execute(
            """
            INSERT INTO vacation_types (
              enterprise_id, name, is_paid_default, is_active
            ) VALUES (?, 'Annual Test Leave', 1, 1)
            """,
            (organization[0],),
        ).lastrowid

        self.connection.execute(
            """
            INSERT INTO vacations (
              employee_id, vacation_type_id, starts_at, ends_at,
              days_count, working_days_count, is_paid, status
            ) VALUES (?, ?, '2026-09-01', '2026-09-10', 10, 8, 1, 'approved')
            """,
            (employee_id, vacation_type_id),
        )

        with self.assertRaisesRegex(sqlite3.IntegrityError, "пересека|overlap"):
            self.connection.execute(
                """
                INSERT INTO vacations (
                  employee_id, vacation_type_id, starts_at, ends_at,
                  days_count, working_days_count, is_paid, status
                ) VALUES (?, ?, '2026-09-08', '2026-09-12', 5, 3, 1, 'planned')
                """,
                (employee_id, vacation_type_id),
            )

    def test_used_vacancy_is_archived_and_unused_vacancy_is_deleted(self):
        organization = seed_organization(self.connection)
        used_vacancy_id = self.connection.execute(
            """
            INSERT INTO vacancies (
              position_id, title, status, employment_type, openings_count
            ) VALUES (?, 'Frontend Developer', 'open', 'full_time', 1)
            """,
            (organization[2],),
        ).lastrowid
        self.connection.execute(
            """
            INSERT INTO candidates (vacancy_id, last_name, first_name, status)
            VALUES (?, 'Candidate', 'Used', 'new')
            """,
            (used_vacancy_id,),
        )

        self.connection.execute(
            "DELETE FROM vacancies WHERE id = ?", (used_vacancy_id,)
        )
        archived = self.connection.execute(
            "SELECT status, is_archived, archived_at FROM vacancies WHERE id = ?",
            (used_vacancy_id,),
        ).fetchone()
        self.assertEqual(archived[0], "closed")
        self.assertEqual(archived[1], 1)
        self.assertTrue(archived[2])

        with self.assertRaisesRegex(sqlite3.IntegrityError, "архивную вакансию"):
            self.connection.execute(
                """
                INSERT INTO candidates (vacancy_id, last_name, first_name, status)
                VALUES (?, 'Candidate', 'Blocked', 'new')
                """,
                (used_vacancy_id,),
            )

        unused_vacancy_id = self.connection.execute(
            """
            INSERT INTO vacancies (
              position_id, title, status, employment_type, openings_count
            ) VALUES (?, 'Unused Frontend Developer', 'draft', 'full_time', 1)
            """,
            (organization[2],),
        ).lastrowid
        self.connection.execute(
            "DELETE FROM vacancies WHERE id = ?", (unused_vacancy_id,)
        )
        self.assertIsNone(
            self.connection.execute(
                "SELECT id FROM vacancies WHERE id = ?", (unused_vacancy_id,)
            ).fetchone()
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
