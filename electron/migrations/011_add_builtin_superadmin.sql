DROP TRIGGER IF EXISTS employees_preserve_last_superadmin;

CREATE TABLE system_admin_accounts (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (username = 'superadmin'),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

UPDATE users
SET username = 'former_superadmin_' || id || '_' || lower(hex(randomblob(4)))
WHERE username = 'superadmin' COLLATE NOCASE;

INSERT INTO system_admin_accounts (
  id,
  username,
  password_hash,
  password_salt,
  must_change_password
) VALUES (
  1,
  'superadmin',
  '73393f40992dbf55ecb676a6280be2e0273a0e01a6114cf2aab921483ee5131a5be6c3e4e603414122368c52c2d657d5f54908323779afb57dda975928db60a8',
  '8f0a4d69f5372f61b4c2d5e94a1f30c7',
  0
);

DELETE FROM user_roles
WHERE role_id = (SELECT id FROM roles WHERE system_key = 'superadmin');

INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT user.id, role.id
FROM users AS user
JOIN roles AS role ON role.system_key = 'employee'
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles WHERE user_roles.user_id = user.id
);

CREATE TRIGGER user_roles_superadmin_insert_guard
BEFORE INSERT ON user_roles
WHEN EXISTS (
  SELECT 1 FROM roles WHERE id = NEW.role_id AND system_key = 'superadmin'
)
BEGIN
  SELECT RAISE(ABORT, 'Роль superadmin принадлежит только встроенной системной учётной записи');
END;

CREATE TRIGGER user_roles_superadmin_update_guard
BEFORE UPDATE OF role_id ON user_roles
WHEN EXISTS (
  SELECT 1 FROM roles WHERE id = NEW.role_id AND system_key = 'superadmin'
)
BEGIN
  SELECT RAISE(ABORT, 'Роль superadmin принадлежит только встроенной системной учётной записи');
END;

CREATE TRIGGER system_admin_identity_update_guard
BEFORE UPDATE OF username ON system_admin_accounts
WHEN NEW.username <> 'superadmin'
BEGIN
  SELECT RAISE(ABORT, 'Логин встроенного superadmin нельзя изменить');
END;

CREATE TRIGGER system_admin_delete_guard
BEFORE DELETE ON system_admin_accounts
BEGIN
  SELECT RAISE(ABORT, 'Встроенного superadmin нельзя удалить');
END;

CREATE TRIGGER system_admin_updated_at
AFTER UPDATE ON system_admin_accounts
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE system_admin_accounts
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
