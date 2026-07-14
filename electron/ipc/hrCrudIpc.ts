import { ipcMain } from "electron";
import type {
  HrCreateParams,
  HrDeleteParams,
  HrEmploymentChangeParams,
  HrGetByIdParams,
  HrListParams,
  RecruitmentListParams,
  SaveCandidateParams,
  SaveVacancyParams,
  HrUpdateParams,
} from "../../src/shared/types/hr";
import { getDatabase } from "../database/connection";
import { HrCrudRepository } from "../repositories/hrCrudRepository";
import { RecruitmentRepository } from "../repositories/recruitmentRepository";
import { HrCrudService } from "../services/hrCrudService";
import { RecruitmentService } from "../services/recruitmentService";

export function registerHrCrudIpcHandlers(): void {
  const database = getDatabase();
  const repository = new HrCrudRepository(database);
  const service = new HrCrudService(repository);
  const recruitmentService = new RecruitmentService(
    new RecruitmentRepository(database),
  );

  ipcMain.handle("hr:list", (_event, params: HrListParams) =>
    service.list(params),
  );

  ipcMain.handle("hr:getById", (_event, params: HrGetByIdParams) =>
    service.getById(params),
  );

  ipcMain.handle("hr:create", (_event, params: HrCreateParams) =>
    service.create(params),
  );

  ipcMain.handle("hr:update", (_event, params: HrUpdateParams) =>
    service.update(params),
  );

  ipcMain.handle(
    "hr:changeEmployment",
    (_event, params: HrEmploymentChangeParams) =>
      service.changeEmployment(params),
  );

  ipcMain.handle("hr:delete", (_event, params: HrDeleteParams) =>
    service.delete(params),
  );

  ipcMain.handle("hr:dashboard", () => service.dashboard());

  ipcMain.handle(
    "recruitment:listVacancies",
    (_event, params: RecruitmentListParams) =>
      recruitmentService.listVacancies(params),
  );
  ipcMain.handle("recruitment:getVacancy", (_event, id: number) =>
    recruitmentService.getVacancy(id),
  );
  ipcMain.handle(
    "recruitment:saveVacancy",
    (_event, params: SaveVacancyParams) =>
      recruitmentService.saveVacancy(params),
  );
  ipcMain.handle("recruitment:deleteVacancy", (_event, id: number) =>
    recruitmentService.deleteVacancy(id),
  );
  ipcMain.handle(
    "recruitment:listCandidates",
    (_event, params: RecruitmentListParams) =>
      recruitmentService.listCandidates(params),
  );
  ipcMain.handle("recruitment:getCandidate", (_event, id: number) =>
    recruitmentService.getCandidate(id),
  );
  ipcMain.handle(
    "recruitment:saveCandidate",
    (_event, params: SaveCandidateParams) =>
      recruitmentService.saveCandidate(params),
  );
  ipcMain.handle("recruitment:deleteCandidate", (_event, id: number) =>
    recruitmentService.deleteCandidate(id),
  );
}
