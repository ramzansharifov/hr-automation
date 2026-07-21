import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type {
  AuthEmployeeOption,
  AuthSession,
  AuthState,
  BootstrapSuperadminParams,
  ChangeOwnPasswordParams,
  LoginParams,
} from "../../src/shared/types/access";
import { AuthenticationRepository } from "../repositories/authenticationRepository";
import { AccessControlService } from "./accessControlService";

const usernamePattern = /^[a-zA-Z0-9._-]{3,64}$/;
const minimumPasswordLength = 8;

export class AuthenticationService {
  private currentUserId: number | null = null;

  constructor(
    private readonly repository: AuthenticationRepository,
    private readonly accessControlService: AccessControlService,
  ) {}

  getState(): AuthState {
    return {
      isInitialized: this.repository.countUsers() > 0,
      session: this.getCurrentSession(),
    };
  }

  listBootstrapEmployees(): AuthEmployeeOption[] {
    if (this.repository.countUsers() > 0) {
      throw new Error("Первичная настройка уже выполнена");
    }
    return this.repository.listBootstrapEmployees();
  }

  bootstrap(params: BootstrapSuperadminParams): AuthSession {
    if (this.repository.countUsers() > 0) {
      throw new Error("Первичная настройка уже выполнена");
    }

    const roleId = this.repository.getSystemRoleId("superadmin");
    if (!roleId) throw new Error("Системная роль superadmin не найдена");

    const created = this.accessControlService.saveUser({
      employeeId: params.employeeId,
      username: normalizeUsername(params.username),
      password: params.password,
      status: "active",
      roleIds: [roleId],
      mustChangePassword: false,
    });

    this.currentUserId = created.id;
    this.repository.updateLastLogin(created.id);
    const session = this.repository.getSession(created.id);
    if (!session) throw new Error("Не удалось открыть сессию superadmin");
    return session;
  }

  login(params: LoginParams): AuthSession {
    if (this.repository.countUsers() === 0) {
      throw new Error("Сначала выполните первичную настройку системы");
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

    const session = this.repository.getSession(credentials.userId);
    if (!session) {
      throw new Error("Учётная запись недоступна или сотрудник неактивен");
    }

    this.currentUserId = credentials.userId;
    this.repository.updateLastLogin(credentials.userId);
    return session;
  }

  logout(): { success: true } {
    this.currentUserId = null;
    return { success: true };
  }

  changeOwnPassword(params: ChangeOwnPasswordParams): AuthSession {
    const session = this.getCurrentSession();
    if (!session) throw new Error("Требуется вход в систему");
    const credentials = this.repository.findCredentialsByUserId(session.userId);
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
      session.userId,
      nextPassword.hash,
      nextPassword.salt,
    );

    const updatedSession = this.repository.getSession(session.userId);
    if (!updatedSession) throw new Error("Не удалось обновить сессию");
    return updatedSession;
  }

  getCurrentSession(): AuthSession | null {
    if (!this.currentUserId) return null;
    const session = this.repository.getSession(this.currentUserId);
    if (!session) this.currentUserId = null;
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
