import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type {
  AuthEmployeeOption,
  AuthSession,
  AuthState,
  BootstrapSuperadminParams,
  ChangeOwnPasswordParams,
  LoginParams,
} from "../../src/shared/types/access";
import {
  AuthenticationRepository,
  type AuthenticationAccountType,
} from "../repositories/authenticationRepository";

const usernamePattern = /^[a-zA-Z0-9._-]{3,64}$/;
const minimumPasswordLength = 8;

interface CurrentIdentity {
  accountId: number;
  accountType: AuthenticationAccountType;
}

export class AuthenticationService {
  private currentIdentity: CurrentIdentity | null = null;

  constructor(private readonly repository: AuthenticationRepository) {}

  getState(): AuthState {
    return {
      isInitialized: this.repository.hasSystemAdmin(),
      session: this.getCurrentSession(),
    };
  }

  listBootstrapEmployees(): AuthEmployeeOption[] {
    throw new Error(
      "Первичная настройка больше не требуется. Используйте логин superadmin и пароль superadmin",
    );
  }

  bootstrap(params: BootstrapSuperadminParams): AuthSession {
    void params;
    throw new Error(
      "Встроенный superadmin уже создан. Используйте логин superadmin и пароль superadmin",
    );
  }

  login(params: LoginParams): AuthSession {
    if (!this.repository.hasSystemAdmin()) {
      throw new Error("Встроенная учётная запись superadmin не создана");
    }

    const username = normalizeUsername(params.username);
    const credentials = this.repository.findCredentialsByUsername(username);
    if (
      !credentials ||
      !verifyPassword(
        params.password,
        credentials.passwordSalt,
        credentials.passwordHash,
      )
    ) {
      throw new Error("Неверный логин или пароль");
    }
    if (credentials.status !== "active") {
      throw new Error("Учётная запись заблокирована");
    }

    const session = this.repository.getSession(
      credentials.accountType,
      credentials.accountId,
    );
    if (!session) {
      throw new Error(
        credentials.accountType === "system_admin"
          ? "Системная учётная запись недоступна"
          : "Учётная запись недоступна или сотрудник неактивен",
      );
    }

    this.currentIdentity = {
      accountId: credentials.accountId,
      accountType: credentials.accountType,
    };
    this.repository.updateLastLogin(
      credentials.accountType,
      credentials.accountId,
    );
    return session;
  }

  logout(): { success: true } {
    this.currentIdentity = null;
    return { success: true };
  }

  changeOwnPassword(params: ChangeOwnPasswordParams): AuthSession {
    const identity = this.currentIdentity;
    if (!identity) throw new Error("Требуется вход в систему");

    const credentials = this.repository.findCredentialsByIdentity(
      identity.accountType,
      identity.accountId,
    );
    if (!credentials) throw new Error("Пользователь не найден");
    if (
      !verifyPassword(
        params.currentPassword,
        credentials.passwordSalt,
        credentials.passwordHash,
      )
    ) {
      throw new Error("Текущий пароль указан неверно");
    }

    validatePassword(params.newPassword);
    if (params.currentPassword === params.newPassword) {
      throw new Error("Новый пароль должен отличаться от текущего");
    }

    const nextPassword = hashPassword(params.newPassword);
    this.repository.updateOwnPassword(
      identity.accountType,
      identity.accountId,
      nextPassword.hash,
      nextPassword.salt,
    );

    const updatedSession = this.repository.getSession(
      identity.accountType,
      identity.accountId,
    );
    if (!updatedSession) throw new Error("Не удалось обновить сессию");
    return updatedSession;
  }

  getCurrentSession(): AuthSession | null {
    if (!this.currentIdentity) return null;
    const session = this.repository.getSession(
      this.currentIdentity.accountType,
      this.currentIdentity.accountId,
    );
    if (!session) this.currentIdentity = null;
    return session;
  }

  requireSession(): AuthSession {
    const session = this.getCurrentSession();
    if (!session) throw new Error("Требуется вход в систему");
    if (session.mustChangePassword) {
      throw new Error("Сначала смените временный пароль");
    }
    return session;
  }
}

function normalizeUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!usernamePattern.test(normalized)) {
    throw new Error(
      "Логин должен содержать 3–64 символа: латинские буквы, цифры, точку, дефис или подчёркивание",
    );
  }
  return normalized;
}

function validatePassword(password: string): void {
  if (password.length < minimumPasswordLength) {
    throw new Error(
      `Пароль должен содержать минимум ${minimumPasswordLength} символов`,
    );
  }
  if (!/[A-Za-zА-Яа-я]/.test(password) || !/\d/.test(password)) {
    throw new Error("Пароль должен содержать хотя бы одну букву и одну цифру");
  }
}

function hashPassword(password: string): { hash: string; salt: string } {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): boolean {
  try {
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
