import { ipcMain } from "electron";
import type {
  HrCreateParams,
  HrDeleteParams,
  HrEmploymentChangeParams,
  HrEntityKey,
  HrGetByIdParams,
  HrListParams,
  HrRecord,
  RecruitmentListParams,
  SaveCandidateParams,
  SaveVacancyParams,
  HrUpdateParams,
} from "../../src/shared/types/hr";
import type {
  AuthSession,
  BootstrapSuperadminParams,
  ChangeOwnPasswordParams,
  LoginParams,
  ResetAccessPasswordParams,
  SaveAccessRoleParams,
  SaveAccessUserParams,
} from "../../src/shared/types/access";
import { getDatabase } from "../database/connection";
import { AccessControlRepository } from "../repositories/accessControlRepository";
import { AuthenticationRepository } from "../repositories/authenticationRepository";
import { HrCrudRepository } from "../repositories/hrCrudRepository";
import { RecruitmentRepository } from "../repositories/recruitmentRepository";
import { AccessControlService } from "../services/accessControlService";
import { AuthenticationService } from "../services/authenticationService";
import { AuthorizationService } from "../services/authorizationService";
import { HrCrudService } from "../services/hrCrudService";
import { RecruitmentService } from "../services/recruitmentService";

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
    accessService,
  );
  const authorizationService = new AuthorizationService(
    database,
    authenticationService,
  );

  ipcMain.handle("auth:state", () => authenticationService.getState());
  ipcMain.handle("auth:bootstrapEmployees", () =>
    authenticationService.listBootstrapEmployees(),
  );
  ipcMain.handle(
    "auth:bootstrap",
    (_event, params: BootstrapSuperadminParams) =>
      authenticationService.bootstrap(params),
  );
  ipcMain.handle("auth:login", (_event, params: LoginParams) =>
    authenticationService.login(params),
  );
  ipcMain.handle("auth:logout", () => authenticationService.logout());
  ipcMain.handle(
    "auth:changePassword",
    (_event, params: ChangeOwnPasswordParams) =>
      authenticationService.changeOwnPassword(params),
  );

  ipcMain.handle("hr:list", (_event, params: HrListParams) =>
    service.list(authorizationService.scopeListParams(params.entity, params)),
  );

  ipcMain.handle("hr:getById", (_event, params: HrGetByIdParams) => {
    const record = service.getById(params);
    if (record) {
      const session = authenticationService.getCurrentSession();
      if (!canViewOwnOrganizationContext(params.entity, record, session)) {
        authorizationService.assertCanViewRecord(params.entity, record);
      }
    }
    return record;
  });

  ipcMain.handle("hr:create", (_event, params: HrCreateParams) => {
    authorizationService.assertCanCreate(params.entity, params.data);
    return service.create(params);
  });

  ipcMain.handle("hr:update", (_event, params: HrUpdateParams) => {
    const existing = service.getById({ entity: params.entity, id: params.id });
    if (!existing) throw new Error("Запись не найдена");
    authorizationService.assertCanUpdate(params.entity, existing, params.data);
    return service.update(params);
  });

  ipcMain.handle(
    "hr:changeEmployment",
    (_event, params: HrEmploymentChangeParams) => {
      const employee = service.getById({
        entity: "employees",
        id: params.employeeId,
      });
      if (!employee) throw new Error("Сотрудник не найден");
      authorizationService.assertCanChangeEmployment(employee);
      return service.changeEmployment(params);
    },
  );

  ipcMain.handle("hr:delete", (_event, params: HrDeleteParams) => {
    const existing = service.getById({ entity: params.entity, id: params.id });
    if (!existing) throw new Error("Запись не найдена");
    authorizationService.assertCanDelete(params.entity, existing);
    return service.delete(params);
  });

  ipcMain.handle("hr:dashboard", () => authorizationService.dashboard());

  ipcMain.handle(
    "recruitment:listVacancies",
    (_event, params: RecruitmentListParams) =>
      authorizationService.filterVacancies(
        recruitmentService.listVacancies(params),
      ),
  );
  ipcMain.handle("recruitment:getVacancy", (_event, id: number) => {
    const profile = recruitmentService.getVacancy(id);
    if (profile) authorizationService.assertCanViewVacancy(profile.vacancy);
    return profile;
  });
  ipcMain.handle(
    "recruitment:saveVacancy",
    (_event, params: SaveVacancyParams) => {
      if (params.id) {
        const existing = recruitmentService.getVacancy(params.id);
        if (!existing) throw new Error("Вакансия не найдена");
        authorizationService.assertCanManageVacancy(existing.vacancy);
      }
      authorizationService.assertCanManageVacancy({
        position_id: params.positionId,
      });
      return recruitmentService.saveVacancy(params);
    },
  );
  ipcMain.handle("recruitment:deleteVacancy", (_event, id: number) => {
    const existing = recruitmentService.getVacancy(id);
    if (!existing) throw new Error("Вакансия не найдена");
    authorizationService.assertCanManageVacancy(existing.vacancy);
    return recruitmentService.deleteVacancy(id);
  });

  ipcMain.handle(
    "recruitment:listCandidates",
    (_event, params: RecruitmentListParams) =>
      authorizationService.filterCandidates(
        recruitmentService.listCandidates(params),
      ),
  );
  ipcMain.handle("recruitment:getCandidate", (_event, id: number) => {
    const profile = recruitmentService.getCandidate(id);
    if (profile) authorizationService.assertCanViewCandidate(profile.candidate);
    return profile;
  });
  ipcMain.handle(
    "recruitment:saveCandidate",
    (_event, params: SaveCandidateParams) => {
      if (params.id) {
        const existing = recruitmentService.getCandidate(params.id);
        if (!existing) throw new Error("Кандидат не найден");
        authorizationService.assertCanManageCandidate(existing.candidate);
      }
      authorizationService.assertCanManageCandidate({
        vacancy_id: params.vacancyId,
      });
      return recruitmentService.saveCandidate(params);
    },
  );
  ipcMain.handle("recruitment:deleteCandidate", (_event, id: number) => {
    const existing = recruitmentService.getCandidate(id);
    if (!existing) throw new Error("Кандидат не найден");
    authorizationService.assertCanManageCandidate(existing.candidate);
    return recruitmentService.deleteCandidate(id);
  });

  ipcMain.handle("access:overview", () => {
    authorizationService.requireGlobalPermission("access.manage");
    return accessService.getOverview();
  });
  ipcMain.handle("access:saveRole", (_event, params: SaveAccessRoleParams) => {
    authorizationService.requireGlobalPermission("access.manage");
    return accessService.saveRole(params);
  });
  ipcMain.handle("access:deleteRole", (_event, id: number) => {
    authorizationService.requireGlobalPermission("access.manage");
    return accessService.deleteRole(id);
  });
  ipcMain.handle("access:saveUser", (_event, params: SaveAccessUserParams) => {
    authorizationService.requireGlobalPermission("access.manage");
    return accessService.saveUser(params);
  });
  ipcMain.handle(
    "access:resetPassword",
    (_event, params: ResetAccessPasswordParams) => {
      authorizationService.requireGlobalPermission("access.manage");
      return accessService.resetPassword(params);
    },
  );
  ipcMain.handle("access:deleteUser", (_event, id: number) => {
    authorizationService.requireGlobalPermission("access.manage");
    return accessService.deleteUser(id);
  });
}

function canViewOwnOrganizationContext(
  entity: HrEntityKey,
  record: HrRecord,
  session: AuthSession | null,
): boolean {
  if (!session || !session.permissionCodes.includes("profile.view")) return false;
  if (entity === "departments") {
    return Number(record.id) === session.departmentId;
  }
  if (entity === "positions") {
    return Number(record.department_id) === session.departmentId;
  }
  if (entity === "enterprises") {
    return Number(record.id) === session.enterpriseId;
  }
  return false;
}
