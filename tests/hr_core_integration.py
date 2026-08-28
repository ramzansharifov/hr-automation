import glob
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


def seed_organization(connection, name="HR Core Test Enterprise"):
    enterprise_id = connection.execute(
        "INSERT INTO enterprises (name) VALUES (?)", (name,)
    ).lastrowid
    department_id = connection.execute(
        "INSERT INTO departments (enterprise_id, name) VALUES (?, ?)",
        (enterprise_id, f"Engineering {enterprise_id}"),
    ).lastrowid
    position_id = connection.execute(
        "INSERT INTO positions (department_id, name) VALUES (?, ?)",
        (department_id, f"Frontend Developer {enterprise_id}"),
    ).lastrowid
    return enterprise_id, department_id, position_id


def seed_active_employee(
    connection,
    organization,
    *,
    employee_number=None,
    email=None,
    last_name="Testov",
):
    enterprise_id, department_id, position_id = organization
    return connection.execute(
        """
        INSERT INTO employees (
          enterprise_id, department_id, position_id, employee_number,
          last_name, first_name, hire_date, status, lifecycle_status,
          employment_started_at, salary, email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'active', ?, 5000, ?)
        """,
        (
            enterprise_id,
            department_id,
            position_id,
            employee_number,
            last_name,
            "Employee",
            "2026-01-15",
            "2026-01-15",
            email,
        ),
    ).lastrowid


def vacation_type_id(connection, enterprise_id):
    row = connection.execute(
        """
        SELECT id FROM vacation_types
        WHERE enterprise_id = ? AND is_active = 1
        ORDER BY id LIMIT 1
        """,
        (enterprise_id,),
    ).fetchone()
    if not row:
        raise AssertionError("No vacation type was seeded for enterprise")
    return row[0]


def document_type_id(connection, enterprise_id, name="Трудовой договор"):
    row = connection.execute(
        """
        SELECT id FROM document_types
        WHERE enterprise_id = ? AND name = ?
        LIMIT 1
        """,
        (enterprise_id, name),
    ).fetchone()
    if not row:
        raise AssertionError(f"Document type {name!r} was not seeded")
    return row[0]


class HrCoreIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.connection = create_database()

    def tearDown(self):
        self.connection.close()

    def test_final_schema_permissions_and_removed_leave_backend(self):
        required_tables = {
            "leadership_history",
            "employee_documents",
            "document_types",
            "data_exchange_runs",
        }
        actual_tables = {
            row[0]
            for row in self.connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        self.assertTrue(required_tables.issubset(actual_tables))
        self.assertNotIn("leave_balances", actual_tables)
        self.assertNotIn("work_calendar_days", actual_tables)

        employee_columns = {
            row[1]
            for row in self.connection.execute("PRAGMA table_info(employees)").fetchall()
        }
        self.assertTrue(
            {
                "enterprise_id",
                "lifecycle_status",
                "employment_started_at",
                "registered_at",
            }.issubset(employee_columns)
        )

        document_columns = {
            row[1]
            for row in self.connection.execute(
                "PRAGMA table_info(employee_documents)"
            ).fetchall()
        }
        self.assertTrue(
            {
                "document_type_id",
                "enterprise_id_snapshot",
                "enterprise_name_snapshot",
            }.issubset(document_columns)
        )

        history_columns = {
            row[1]
            for row in self.connection.execute(
                "PRAGMA table_info(employment_history)"
            ).fetchall()
        }
        self.assertTrue(
            {
                "previous_enterprise_id",
                "new_enterprise_id",
                "previous_enterprise_name",
                "new_enterprise_name",
            }.issubset(history_columns)
        )

        vacation_columns = {
            row[1]
            for row in self.connection.execute("PRAGMA table_info(vacations)").fetchall()
        }
        self.assertTrue(
            {"enterprise_id_snapshot", "enterprise_name_snapshot"}.issubset(
                vacation_columns
            )
        )
        self.assertNotIn("working_days_count", vacation_columns)
        self.assertNotIn("entitlement_year", vacation_columns)

        expected_permission_codes = {
            "documents.view",
            "documents.add",
            "documents.delete",
            "document_types.view",
            "document_types.create",
            "document_types.edit",
            "document_types.delete",
            "attention.view",
            "analytics.view",
            "data_exchange.import",
            "data_exchange.export",
        }
        actual_permission_codes = {
            row[0]
            for row in self.connection.execute(
                "SELECT code FROM permissions WHERE code IN ({})".format(
                    ",".join("?" for _ in expected_permission_codes)
                ),
                tuple(expected_permission_codes),
            ).fetchall()
        }
        self.assertEqual(actual_permission_codes, expected_permission_codes)
        self.assertEqual(
            self.connection.execute(
                "SELECT COUNT(*) FROM permissions WHERE code LIKE 'leave.%'"
            ).fetchone()[0],
            0,
        )

    def test_pending_employee_has_enterprise_and_no_fake_hire_history(self):
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

        with self.assertRaisesRegex(sqlite3.IntegrityError, "предприяти"):
            self.connection.execute(
                """
                INSERT INTO employees (
                  last_name, first_name, hire_date,
                  status, lifecycle_status, employment_started_at
                ) VALUES ('No', 'Enterprise', '2026-08-25',
                          'pending_assignment', 'pending_assignment', NULL)
                """
            )

    def test_employee_number_is_enterprise_scoped_and_email_is_contact_data(self):
        first_org = seed_organization(self.connection, "First Enterprise")
        second_org = seed_organization(self.connection, "Second Enterprise")

        first_employee = seed_active_employee(
            self.connection,
            first_org,
            employee_number="001",
            email="shared@example.test",
            last_name="First",
        )
        second_employee = seed_active_employee(
            self.connection,
            second_org,
            employee_number="001",
            email="shared@example.test",
            last_name="Second",
        )
        self.assertGreater(first_employee, 0)
        self.assertGreater(second_employee, first_employee)

        with self.assertRaises(sqlite3.IntegrityError):
            seed_active_employee(
                self.connection,
                first_org,
                employee_number="001",
                email="another@example.test",
                last_name="Duplicate",
            )

        duplicate_emails = self.connection.execute(
            """
            SELECT usage_count FROM email_conflicts
            WHERE normalized_email = 'shared@example.test'
            """
        ).fetchone()
        self.assertEqual(duplicate_emails, (2,))

    def test_organization_cannot_be_reparented_between_enterprises(self):
        first_org = seed_organization(self.connection, "First Enterprise")
        second_org = seed_organization(self.connection, "Second Enterprise")

        with self.assertRaisesRegex(sqlite3.IntegrityError, "Предприятие отдела"):
            self.connection.execute(
                "UPDATE departments SET enterprise_id = ? WHERE id = ?",
                (second_org[0], first_org[1]),
            )

        unoccupied_position_id = self.connection.execute(
            "INSERT INTO positions (department_id, name) VALUES (?, ?)",
            (first_org[1], "Unoccupied Position"),
        ).lastrowid
        with self.assertRaisesRegex(sqlite3.IntegrityError, "между предприятиями"):
            self.connection.execute(
                "UPDATE positions SET department_id = ? WHERE id = ?",
                (second_org[1], unoccupied_position_id),
            )

    def test_transfer_revokes_scoped_admin_roles(self):
        first_org = seed_organization(self.connection, "First Enterprise")
        second_org = seed_organization(self.connection, "Second Enterprise")
        employee_id = seed_active_employee(self.connection, first_org)
        user_id = self.connection.execute(
            """
            INSERT INTO users (
              employee_id, username, password_hash, password_salt,
              status, must_change_password
            ) VALUES (?, 'scope-admin', 'hash', 'salt', 'active', 0)
            """,
            (employee_id,),
        ).lastrowid

        role_rows = self.connection.execute(
            """
            SELECT id, system_key FROM roles
            WHERE system_key IN ('enterprise_admin', 'department_admin')
            """
        ).fetchall()
        role_ids = {system_key: role_id for role_id, system_key in role_rows}
        self.assertEqual(set(role_ids), {"enterprise_admin", "department_admin"})
        for role_id in role_ids.values():
            self.connection.execute(
                "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
                (user_id, role_id),
            )

        self.connection.execute(
            """
            UPDATE employees
            SET enterprise_id = ?, department_id = ?, position_id = ?
            WHERE id = ?
            """,
            (second_org[0], second_org[1], second_org[2], employee_id),
        )

        remaining_scoped_roles = self.connection.execute(
            """
            SELECT role.system_key
            FROM user_roles AS user_role
            JOIN roles AS role ON role.id = user_role.role_id
            WHERE user_role.user_id = ?
              AND role.system_key IN ('enterprise_admin', 'department_admin')
            """,
            (user_id,),
        ).fetchall()
        self.assertEqual(remaining_scoped_roles, [])

    def test_historical_enterprise_snapshots_survive_employee_transfer(self):
        first_org = seed_organization(self.connection, "First Enterprise")
        second_org = seed_organization(self.connection, "Second Enterprise")
        employee_id = seed_active_employee(self.connection, first_org)
        type_id = document_type_id(self.connection, first_org[0])
        leave_type_id = vacation_type_id(self.connection, first_org[0])

        document_id = self.connection.execute(
            """
            INSERT INTO employee_documents (
              employee_id, document_type_id, document_type, title,
              original_name, stored_name, relative_path,
              size_bytes, sha256
            ) VALUES (?, ?, 'Трудовой договор', 'Договор',
                      'contract.pdf', 'snapshot-contract.pdf',
                      'employee/snapshot-contract.pdf', 100, ?)
            """,
            (employee_id, type_id, "a" * 64),
        ).lastrowid
        vacation_id = self.connection.execute(
            """
            INSERT INTO vacations (
              employee_id, vacation_type_id, starts_at, ends_at,
              days_count, is_paid, status
            ) VALUES (?, ?, '2026-09-01', '2026-09-05', 5, 1, 'approved')
            """,
            (employee_id, leave_type_id),
        ).lastrowid

        before_document = self.connection.execute(
            """
            SELECT enterprise_id_snapshot, enterprise_name_snapshot
            FROM employee_documents WHERE id = ?
            """,
            (document_id,),
        ).fetchone()
        before_vacation = self.connection.execute(
            """
            SELECT enterprise_id_snapshot, enterprise_name_snapshot
            FROM vacations WHERE id = ?
            """,
            (vacation_id,),
        ).fetchone()
        self.assertEqual(before_document, (first_org[0], "First Enterprise"))
        self.assertEqual(before_vacation, (first_org[0], "First Enterprise"))

        self.connection.execute(
            """
            UPDATE employees
            SET enterprise_id = ?, department_id = ?, position_id = ?, salary = 6000
            WHERE id = ?
            """,
            (second_org[0], second_org[1], second_org[2], employee_id),
        )

        after_document = self.connection.execute(
            """
            SELECT enterprise_id_snapshot, enterprise_name_snapshot
            FROM employee_documents WHERE id = ?
            """,
            (document_id,),
        ).fetchone()
        after_vacation = self.connection.execute(
            """
            SELECT enterprise_id_snapshot, enterprise_name_snapshot
            FROM vacations WHERE id = ?
            """,
            (vacation_id,),
        ).fetchone()
        self.assertEqual(after_document, before_document)
        self.assertEqual(after_vacation, before_vacation)

        history = self.connection.execute(
            """
            SELECT previous_enterprise_id, previous_enterprise_name,
                   new_enterprise_id, new_enterprise_name
            FROM employment_history
            WHERE employee_id = ?
            ORDER BY id DESC LIMIT 1
            """,
            (employee_id,),
        ).fetchone()
        self.assertEqual(
            history,
            (
                first_org[0],
                "First Enterprise",
                second_org[0],
                "Second Enterprise",
            ),
        )

    def test_overlapping_active_vacations_are_rejected(self):
        organization = seed_organization(self.connection)
        employee_id = seed_active_employee(self.connection, organization)
        leave_type_id = vacation_type_id(self.connection, organization[0])

        self.connection.execute(
            """
            INSERT INTO vacations (
              employee_id, vacation_type_id, starts_at, ends_at,
              days_count, is_paid, status
            ) VALUES (?, ?, '2026-09-01', '2026-09-10', 10, 1, 'approved')
            """,
            (employee_id, leave_type_id),
        )

        with self.assertRaisesRegex(sqlite3.IntegrityError, "пересека|overlap"):
            self.connection.execute(
                """
                INSERT INTO vacations (
                  employee_id, vacation_type_id, starts_at, ends_at,
                  days_count, is_paid, status
                ) VALUES (?, ?, '2026-09-08', '2026-09-12', 5, 1, 'planned')
                """,
                (employee_id, leave_type_id),
            )

    def test_document_types_are_enterprise_scoped_and_used_types_are_preserved(self):
        organization = seed_organization(self.connection)
        employee_id = seed_active_employee(self.connection, organization)
        enterprise_id = organization[0]

        seeded_types = self.connection.execute(
            "SELECT id, name FROM document_types WHERE enterprise_id = ? ORDER BY name",
            (enterprise_id,),
        ).fetchall()
        self.assertGreaterEqual(len(seeded_types), 6)
        contract_type_id = document_type_id(self.connection, enterprise_id)

        document_id = self.connection.execute(
            """
            INSERT INTO employee_documents (
              employee_id, document_type_id, document_type, title,
              original_name, stored_name, relative_path,
              size_bytes, sha256
            ) VALUES (?, ?, 'Трудовой договор', 'Договор №1',
                      'contract.pdf', 'contract.pdf', '1/contract.pdf',
                      100, ?)
            """,
            (employee_id, contract_type_id, "a" * 64),
        ).lastrowid
        snapshot = self.connection.execute(
            """
            SELECT enterprise_id_snapshot, enterprise_name_snapshot
            FROM employee_documents WHERE id = ?
            """,
            (document_id,),
        ).fetchone()
        self.assertEqual(snapshot, (enterprise_id, "HR Core Test Enterprise"))

        with self.assertRaisesRegex(sqlite3.IntegrityError, "используется"):
            self.connection.execute(
                "DELETE FROM document_types WHERE id = ?", (contract_type_id,)
            )

        other_enterprise_id = self.connection.execute(
            "INSERT INTO enterprises (name) VALUES ('Other Enterprise')"
        ).lastrowid
        other_type_id = document_type_id(self.connection, other_enterprise_id, "Приказ")

        with self.assertRaisesRegex(sqlite3.IntegrityError, "предприятия сотрудника"):
            self.connection.execute(
                """
                INSERT INTO employee_documents (
                  employee_id, document_type_id, document_type, title,
                  original_name, stored_name, relative_path,
                  size_bytes, sha256
                ) VALUES (?, ?, 'Приказ', 'Чужой тип',
                          'wrong.pdf', 'wrong.pdf', '1/wrong.pdf',
                          100, ?)
                """,
                (employee_id, other_type_id, "b" * 64),
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
