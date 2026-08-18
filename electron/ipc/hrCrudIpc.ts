import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type {
  AuthSession,
  BootstrapSuperadminParams,
} from "../../src/shared/types/access";
import type {
  AuditListParams,
  HrEntityKey,
  HrRecord,
} from "../../src/shared/types/hr";
import { getDatabase } from "../database/connection";
import { AccessControlRepository } from "../repositories/accessControlRepository";
import { AuthenticationRepository } from "../repositories/authenticationRepository";
import { HrCrudRepository } from "../repositories/hrCrudRepository";
import { RecruitmentRepository } from "../repositories/recruitmentRepository";
import { AccessControlService } from "../services/accessControlService";
import { AdminDataService } from "../services/adminDataService";
import { AuditService } from "../services/auditService";
import { AuthenticationService } from "../services/authenticationService";
import { AuthorizationService } from "../services/authorizationService";
import { BackupService } from "../services/backupService";
import { HrCrudService } from "../services/hrCrudService";
import { RecruitmentService } from "../services/recruitmentService";
import { ipcValidation } from "./ipcValidation";

export function registerHrCrudIpcHandlers(): void {
  const database = getDatabase();
  const service = new HrCrudService(new HrCrudRepository(database));
  const recruitmentService = new RecruitmentService(
    new RecruitmentRepository(database),
  );
  const accessService = new AccessControlService(
    new AccessControlRepository(database),
  );
  const authenticationService = new AuthenticationService(
    new AuthenticationRepository(database),
  );
  const authorizationService = new AuthorizationService(
    database,
    authenticationService,
  );
  const auditService = new AuditService(database);
  const backupService = new BackupService();
  const adminDataService = new AdminDataService(database);

  ipcMain.handle("auth:state", (event) => {
    assertTrustedSender(event);
    return authenticationService.getState();
  });
  ipcMain.handle("auth:bootstrapEmployees", (event) => {
    assertTrustedSender(event);
    return authenticationService.listBootstrapEmployees();
  });
  ipcMain.handle("auth:bootstrap", (event, params: BootstrapSuperadminParams) => {
    assertTrustedSender(event);
    return authenticationService.bootstrap(params);
  });
  ipcMain.handle("auth:login", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authenticationService.login(ipcValidation.login(raw));
    auditService.record(session, "login", "auth", session.userId);
    return session;
  });
  ipcMain.handle("auth:logout", (event) => {
    assertTrustedSender(event);
    const session = authenticationService.getCurrentSession();
    if (session) auditService.record(session, "logout", "auth", session.userId);
    return authenticationService.logout();
  });
  ipcMain.handle("auth:changePassword", (event, raw: unknown) => {
    assertTrustedSender(event);
    const previousSession = authenticationService.requireSession();
    const session = authenticationService.changeOwnPassword(
      ipcValidation.changePassword(raw),
    );
    auditService.record(previousSession, "password.change", "auth", session.userId);
    return session;
  });

  ipcMain.handle("hr:list", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.list(raw);
    return service.list(authorizationService.scopeListParams(params.entity, params));
  });

  ipcMain.handle("hr:getById", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.getById(raw);
    const record = service.getById(params);
    if (record) {
      const session = authenticationService.getCurrentSession();
      if (!canViewOwnOrganizationContext(params.entity, record, session)) {
        authorizationService.assertCanViewRecord(params.entity, record);
      }
    }
    return record;
  });

  ipcMain.handle("hr:create", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.create(raw);
    authorizationService.assertCanCreate(params.entity, params.data);
    const created = service.create(params);
    auditService.record(
      authenticationService.requireSession(),
      "create",
      params.entity,
      Number(created.id) || null,
      null,
      created,
    );
    return created;
  });

  ipcMain.handle("hr:update", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.update(raw);
    const existing = service.getById({ entity: params.entity, id: params.id });
    if (!existing) throw new Error("Запись не найдена");
    authorizationService.assertCanUpdate(params.entity, existing, params.data);
    const session = authenticationService.requireSession();
    const data =
      params.entity === "vacations"
        ? applyVacationDecision(params.data, existing, session)
        : params.data;
    const updated = service.update({ ...params, data });
    auditService.record(
      session,
      "update",
      params.entity,
      params.id,
      existing,
      updated,
    );
    return updated;
  });

  ipcMain.handle("hr:changeEmployment", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.employmentChange(raw);
    const employee = service.getById({ entity: "employees", id: params.employeeId });
    if (!employee) throw new Error("Сотрудник не найден");
    authorizationService.assertCanChangeEmployment(employee);
    const updated = service.changeEmployment(params);
    auditService.record(
      authenticationService.requireSession(),
      "employment.change",
      "employees",
      params.employeeId,
      employee,
      updated,
      { effectiveAt: params.effectiveAt, reason: params.reason },
    );
    return updated;
  });

  ipcMain.handle("hr:terminateEmployee", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.termination(raw);
    const employee = service.getById({ entity: "employees", id: params.employeeId });
    if (!employee) throw new Error("Сотрудник не найден");
    authorizationService.assertCanChangeEmployment(employee);
    const updated = service.terminateEmployee(params);
    auditService.record(
      authenticationService.requireSession(),
      "employment.terminate",
      "employees",
      params.employeeId,
      employee,
      updated,
      { effectiveAt: params.effectiveAt, reason: params.reason },
    );
    return updated;
  });

  ipcMain.handle("hr:correctHireDate", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.hireDateCorrection(raw);
    const employee = service.getById({ entity: "employees", id: params.employeeId });
    if (!employee) throw new Error("Сотрудник не найден");
    authorizationService.assertCanChangeEmployment(employee);
    const updated = service.correctHireDate(params);
    auditService.record(
      authenticationService.requireSession(),
      "employment.correct_hire_date",
      "employees",
      params.employeeId,
      employee,
      updated,
      { reason: params.reason },
    );
    return updated;
  });

  ipcMain.handle("hr:delete", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.remove(raw);
    const existing = service.getById({ entity: params.entity, id: params.id });
    if (!existing) throw new Error("Запись не найдена");
    authorizationService.assertCanDelete(params.entity, existing);
    const result = service.delete(params);
    auditService.record(
      authenticationService.requireSession(),
      "delete",
      params.entity,
      params.id,
      existing,
    );
    return result;
  });

  ipcMain.handle("hr:dashboard", (event) => {
    assertTrustedSender(event);
    return authorizationService.dashboard();
  });

  ipcMain.handle("recruitment:listVacancies", (event, raw: unknown) => {
    assertTrustedSender(event);
    return authorizationService.filterVacancies(
      recruitmentService.listVacancies(ipcValidation.recruitmentList(raw)),
    );
  });
  ipcMain.handle("recruitment:getVacancy", (event, raw: unknown) => {
    assertTrustedSender(event);
    const id = ipcValidation.id(raw);
    const profile = recruitmentService.getVacancy(id);
    if (profile) authorizationService.assertCanViewVacancy(profile.vacancy);
    return profile;
  });
  ipcMain.handle("recruitment:saveVacancy", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.saveVacancy(raw);
    const existing = params.id ? recruitmentService.getVacancy(params.id) : null;
    if (existing) authorizationService.assertCanManageVacancy(existing.vacancy);
    authorizationService.assertCanManageVacancy({ position_id: params.positionId });
    const saved = recruitmentService.saveVacancy(params);
    auditService.record(
      authenticationService.requireSession(),
      params.id ? "vacancy.update" : "vacancy.create",
      "vacancies",
      Number(saved.vacancy.id),
      existing?.vacancy ?? null,
      saved.vacancy,
    );
    return saved;
  });
  ipcMain.handle("recruitment:deleteVacancy", (event, raw: unknown) => {
    assertTrustedSender(event);
    const id = ipcValidation.id(raw);
    const existing = recruitmentService.getVacancy(id);
    if (!existing) throw new Error("Вакансия не найдена");
    authorizationService.assertCanManageVacancy(existing.vacancy);
    const result = recruitmentService.deleteVacancy(id);
    auditService.record(
      authenticationService.requireSession(),
      "vacancy.delete",
      "vacancies",
      id,
      existing.vacancy,
    );
    return result;
  });

  ipcMain.handle("recruitment:listCandidates", (event, raw: unknown) => {
    assertTrustedSender(event);
    return authorizationService.filterCandidates(
      recruitmentService.listCandidates(ipcValidation.recruitmentList(raw)),
    );
  });
  ipcMain.handle("recruitment:getCandidate", (event, raw: unknown) => {
    assertTrustedSender(event);
    const id = ipcValidation.id(raw);
    const profile = recruitmentService.getCandidate(id);
    if (profile) authorizationService.assertCanViewCandidate(profile.candidate);
    return profile;
  });
  ipcMain.handle("recruitment:saveCandidate", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.saveCandidate(raw);
    const existing = params.id ? recruitmentService.getCandidate(params.id) : null;
    if (existing) authorizationService.assertCanManageCandidate(existing.candidate);
    authorizationService.assertCanManageCandidate({ vacancy_id: params.vacancyId });
    const saved = recruitmentService.saveCandidate(params);
    auditService.record(
      authenticationService.requireSession(),
      params.id ? "candidate.update" : "candidate.create",
      "candidates",
      Number(saved.candidate.id),
      existing?.candidate ?? null,
      saved.candidate,
    );
    return saved;
  });
  ipcMain.handle("recruitment:hireCandidate", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.hireCandidate(raw);
    const existing = recruitmentService.getCandidate(params.candidateId);
    if (!existing) throw new Error("Кандидат не найден");
    authorizationService.assertCanManageCandidate(existing.candidate);
    const employee = recruitmentService.hireCandidate(params);
    const session = authenticationService.requireSession();
    auditService.record(
      session,
      "candidate.hire",
      "candidates",
      params.candidateId,
      existing.candidate,
      { ...existing.candidate, status: "hired", employee_id: employee.id },
      { employeeId: employee.id, hireDate: params.hireDate },
    );
    auditService.record(
      session,
      "create_from_candidate",
      "employees",
      Number(employee.id),
      null,
      employee,
      { candidateId: params.candidateId },
    );
    return employee;
  });
  ipcMain.handle("recruitment:deleteCandidate", (event, raw: unknown) => {
    assertTrustedSender(event);
    const id = ipcValidation.id(raw);
    const existing = recruitmentService.getCandidate(id);
    if (!existing) throw new Error("Кандидат не найден");
    authorizationService.assertCanManageCandidate(existing.candidate);
    const result = recruitmentService.deleteCandidate(id);
    auditService.record(
      authenticationService.requireSession(),
      "candidate.delete",
      "candidates",
      id,
      existing.candidate,
    );
    return result;
  });

  ipcMain.handle("access:overview", (event) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("access.manage");
    return accessService.getOverview();
  });
  ipcMain.handle("access:saveRole", (event, raw: unknown) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("access.manage");
    const params = ipcValidation.saveRole(raw);
    const before = params.id ? accessService.getOverview().roles.find((r) => r.id === params.id) : null;
    const saved = accessService.saveRole(params);
    auditService.record(
      authenticationService.requireSession(),
      params.id ? "access.role.update" : "access.role.create",
      "roles",
      saved.id,
      before ? (before as unknown as HrRecord) : null,
      saved as unknown as HrRecord,
    );
    return saved;
  });
  ipcMain.handle("access:deleteRole", (event, raw: unknown) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("access.manage");
    const id = ipcValidation.id(raw);
    const before = accessService.getOverview().roles.find((role) => role.id === id);
    const result = accessService.deleteRole(id);
    auditService.record(
      authenticationService.requireSession(),
      "access.role.delete",
      "roles",
      id,
      before ? (before as unknown as HrRecord) : null,
    );
    return result;
  });
  ipcMain.handle("access:saveUser", (event, raw: unknown) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("access.manage");
    const params = ipcValidation.saveUser(raw);
    const before = params.id ? accessService.getOverview().users.find((u) => u.id === params.id) : null;
    const saved = accessService.saveUser(params);
    auditService.record(
      authenticationService.requireSession(),
      params.id ? "access.user.update" : "access.user.create",
      "users",
      saved.id,
      before ? (before as unknown as HrRecord) : null,
      saved as unknown as HrRecord,
    );
    return saved;
  });
  ipcMain.handle("access:resetPassword", (event, raw: unknown) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("access.manage");
    const params = ipcValidation.resetPassword(raw);
    const result = accessService.resetPassword(params);
    auditService.record(
      authenticationService.requireSession(),
      "access.password.reset",
      "users",
      params.userId,
    );
    return result;
  });
  ipcMain.handle("access:deleteUser", (event, raw: unknown) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("access.manage");
    const id = ipcValidation.id(raw);
    const before = accessService.getOverview().users.find((user) => user.id === id);
    const result = accessService.deleteUser(id);
    auditService.record(
      authenticationService.requireSession(),
      "access.user.delete",
      "users",
      id,
      before ? (before as unknown as HrRecord) : null,
    );
    return result;
  });

  ipcMain.handle("audit:list", (event, raw?: AuditListParams) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("audit.view");
    return auditService.list(raw ?? {});
  });

  ipcMain.handle("admin:listBackups", (event) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("settings.manage");
    return backupService.list();
  });
  ipcMain.handle("admin:createBackup", async (event) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("settings.manage");
    const backup = await backupService.create();
    auditService.record(
      authenticationService.requireSession(),
      "backup.create",
      "system",
      null,
      null,
      null,
      { name: backup.name },
    );
    return backup;
  });
  ipcMain.handle("admin:restoreBackup", (event, raw: unknown) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("settings.manage");
    const name = ipcValidation.backupName(raw);
    auditService.record(
      authenticationService.requireSession(),
      "backup.restore",
      "system",
      null,
      null,
      null,
      { name },
    );
    return backupService.restore(name);
  });
  ipcMain.handle("admin:openBackupsFolder", async (event) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("settings.manage");
    return backupService.openFolder();
  });
  ipcMain.handle("admin:exportEmployeesCsv", (event) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("employees.view");
    const result = adminDataService.exportEmployeesCsv();
    if (!result.canceled) {
      auditService.record(
        authenticationService.requireSession(),
        "export.employees_csv",
        "employees",
      );
    }
    return result;
  });
}

function applyVacationDecision(
  data: HrRecord,
  existing: HrRecord,
  session: AuthSession,
): HrRecord {
  const nextStatus = String(data.status ?? existing.status ?? "planned");
  const previousStatus = String(existing.status ?? "planned");
  if (nextStatus === "approved" && previousStatus !== "approved") {
    return {
      ...data,
      approved_at: new Date().toISOString().slice(0, 10),
      approved_by_account_type:
        session.employeeId === 0 ? "system_admin" : "employee_user",
      approved_by_account_id: session.userId,
      approved_by_name: session.employeeName || session.username,
    };
  }
  if (nextStatus === "rejected" && previousStatus === "planned") {
    return {
      ...data,
      approved_at: null,
      approved_by_account_type: null,
      approved_by_account_id: null,
      approved_by_name: null,
    };
  }
  return data;
}

function canViewOwnOrganizationContext(
  entity: HrEntityKey,
  record: HrRecord,
  session: AuthSession | null,
): boolean {
  if (!session || !session.permissionCodes.includes("profile.view")) return false;
  if (entity === "departments") return Number(record.id) === session.departmentId;
  if (entity === "positions") return Number(record.department_id) === session.departmentId;
  if (entity === "enterprises") return Number(record.id) === session.enterpriseId;
  return false;
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (url.startsWith("file://")) return;
  if (devServer && url.startsWith(devServer)) return;
  throw new Error("Недоверенный источник IPC-запроса");
}
