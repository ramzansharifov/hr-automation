import glob
import re
import sqlite3
import unittest


FK_OFF_MARKER = "-- requires_foreign_keys_off"


class GranularRbacIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        for path in sorted(glob.glob("electron/migrations/*.sql")):
            with open(path, "r", encoding="utf-8") as migration_file:
                sql = migration_file.read()
            needs_fk_off = FK_OFF_MARKER in sql
            if needs_fk_off:
                self.db.execute("PRAGMA foreign_keys = OFF")
            try:
                self.db.executescript(sql)
            finally:
                if needs_fk_off:
                    self.db.execute("PRAGMA foreign_keys = ON")
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def tearDown(self):
        self.db.close()

    def permissions_for(self, system_key):
        return {
            row[0]
            for row in self.db.execute(
                """
                SELECT permission.code
                FROM roles AS role
                JOIN role_permissions AS grant_row ON grant_row.role_id = role.id
                JOIN permissions AS permission ON permission.id = grant_row.permission_id
                WHERE role.system_key = ?
                """,
                (system_key,),
            ).fetchall()
        }

    def test_live_catalog_is_granular_and_has_no_organization_umbrella(self):
        codes = {row[0] for row in self.db.execute("SELECT code FROM permissions")}
        required = {
            "enterprises.view", "enterprises.create", "enterprises.edit",
            "enterprises.delete", "enterprises.assign_leader",
            "departments.view", "departments.create", "departments.edit",
            "departments.delete", "departments.assign_leader",
            "positions.view", "positions.create", "positions.edit", "positions.delete",
            "employee_education.view", "employee_education.create",
            "employee_education.edit", "employee_education.delete",
            "employee_experience.view", "employee_experience.create",
            "employee_experience.edit", "employee_experience.delete",
            "employment_history.view",
        }
        self.assertTrue(required.issubset(codes))
        self.assertFalse(any(code.startswith("organization.") for code in codes))
        self.assertNotIn("employment_history.manage", codes)

    def test_role_builder_exposes_every_live_permission(self):
        live_codes = {row[0] for row in self.db.execute("SELECT code FROM permissions")}
        with open(
            "src/pages/access/rolePermissionSections.ts",
            "r",
            encoding="utf-8",
        ) as role_builder_file:
            role_builder_source = role_builder_file.read()
        exposed_codes = set(
            re.findall(r'"([a-z_]+\.[a-z_]+)"', role_builder_source)
        )
        self.assertEqual(
            exposed_codes,
            live_codes,
            "Every live permission must be configurable in the custom-role UI",
        )

    def test_attention_access_always_includes_dashboard(self):
        broken_roles = self.db.execute(
            """
            SELECT role.code
            FROM roles AS role
            JOIN role_permissions AS attention_grant ON attention_grant.role_id = role.id
            JOIN permissions AS attention_permission
              ON attention_permission.id = attention_grant.permission_id
             AND attention_permission.code = 'attention.view'
            WHERE NOT EXISTS (
              SELECT 1
              FROM role_permissions AS dashboard_grant
              JOIN permissions AS dashboard_permission
                ON dashboard_permission.id = dashboard_grant.permission_id
              WHERE dashboard_grant.role_id = role.id
                AND dashboard_permission.code = 'dashboard.view'
            )
            """
        ).fetchall()
        self.assertEqual(broken_roles, [])

    def test_superadmin_has_every_live_permission(self):
        all_codes = {row[0] for row in self.db.execute("SELECT code FROM permissions")}
        self.assertEqual(self.permissions_for("superadmin"), all_codes)

    def test_enterprise_admin_matrix_stays_inside_enterprise(self):
        codes = self.permissions_for("enterprise_admin")
        self.assertTrue({
            "enterprises.view", "enterprises.edit", "enterprises.assign_leader",
            "departments.view", "departments.create", "departments.edit",
            "departments.delete", "departments.assign_leader",
            "positions.view", "positions.create", "positions.edit", "positions.delete",
            "roles.create",
        }.issubset(codes))
        self.assertTrue({
            "enterprises.create", "enterprises.delete", "audit.view", "employees.export",
            "settings.backups_view", "settings.backups_create",
            "settings.backups_restore", "settings.backups_open_folder",
        }.isdisjoint(codes))

    def test_department_admin_matrix_cannot_escape_department(self):
        codes = self.permissions_for("department_admin")
        self.assertTrue({
            "enterprises.view", "departments.view", "departments.edit",
            "departments.assign_leader", "positions.view", "positions.create",
            "positions.edit", "positions.delete", "roles.create",
        }.issubset(codes))
        self.assertTrue({
            "enterprises.create", "enterprises.edit", "enterprises.delete",
            "enterprises.assign_leader", "departments.create", "departments.delete",
            "vacation_types.create", "vacation_types.edit", "vacation_types.delete",
            "document_types.create", "document_types.edit", "document_types.delete",
            "audit.view", "employees.export", "settings.backups_restore",
        }.isdisjoint(codes))

    def test_role_builders_have_hierarchy_visibility(self):
        rows = self.db.execute(
            """
            SELECT role.code,
                   SUM(permission.code = 'enterprises.view') AS enterprise_view,
                   SUM(permission.code = 'departments.view') AS department_view
            FROM roles AS role
            JOIN role_permissions AS role_create ON role_create.role_id = role.id
            JOIN permissions AS create_permission
              ON create_permission.id = role_create.permission_id
             AND create_permission.code = 'roles.create'
            JOIN role_permissions AS grant_row ON grant_row.role_id = role.id
            JOIN permissions AS permission ON permission.id = grant_row.permission_id
            GROUP BY role.id
            """
        ).fetchall()
        self.assertTrue(rows)
        for role_code, enterprise_view, department_view in rows:
            self.assertGreater(enterprise_view, 0, role_code)
            self.assertGreater(department_view, 0, role_code)

    def test_custom_role_scope_is_immutable_and_assignment_is_scoped(self):
        self.db.execute("INSERT INTO enterprises (id, name) VALUES (101, 'A'), (102, 'B')")
        self.db.execute(
            "INSERT INTO departments (id, enterprise_id, name) VALUES (201, 101, 'A1'), (202, 102, 'B1')"
        )
        self.db.execute(
            """
            INSERT INTO employees (
              id, enterprise_id, department_id, last_name, first_name,
              hire_date, salary, status
            ) VALUES
              (301, 101, 201, 'One', 'Employee', '2026-01-01', 0, 'active'),
              (302, 102, 202, 'Two', 'Employee', '2026-01-01', 0, 'active')
            """
        )
        self.db.execute(
            """
            INSERT INTO users (
              id, employee_id, username, password_hash, password_salt,
              status, must_change_password
            ) VALUES
              (401, 301, 'one', 'hash', 'salt', 'active', 0),
              (402, 302, 'two', 'hash', 'salt', 'active', 0)
            """
        )
        self.db.execute(
            """
            INSERT INTO roles (
              id, code, name, description, scope_type, is_system, system_key,
              enterprise_id, department_id
            ) VALUES (501, 'custom_a1', 'Custom A1', '', 'department', 0, NULL, NULL, 201)
            """
        )
        permission_id = self.db.execute(
            "SELECT id FROM permissions WHERE code = 'positions.view'"
        ).fetchone()[0]
        self.db.execute(
            "INSERT INTO role_permissions (role_id, permission_id) VALUES (501, ?)",
            (permission_id,),
        )
        self.db.execute("INSERT INTO user_roles (user_id, role_id) VALUES (401, 501)")

        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO user_roles (user_id, role_id) VALUES (402, 501)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "UPDATE roles SET department_id = 202 WHERE id = 501"
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
