import { ipcMain } from 'electron'
import type {
  HrCreateParams,
  HrDeleteParams,
  HrGetByIdParams,
  HrListParams,
  HrUpdateParams,
} from '../../src/shared/types/hr'
import { getDatabase } from '../database/connection'
import { HrCrudRepository } from '../repositories/hrCrudRepository'
import { HrCrudService } from '../services/hrCrudService'

export function registerHrCrudIpcHandlers(): void {
  const database = getDatabase()
  const repository = new HrCrudRepository(database)
  const service = new HrCrudService(repository)

  ipcMain.handle('hr:list', (_event, params: HrListParams) => service.list(params))

  ipcMain.handle('hr:getById', (_event, params: HrGetByIdParams) => service.getById(params))

  ipcMain.handle('hr:create', (_event, params: HrCreateParams) => service.create(params))

  ipcMain.handle('hr:update', (_event, params: HrUpdateParams) => service.update(params))

  ipcMain.handle('hr:delete', (_event, params: HrDeleteParams) => service.delete(params))

  ipcMain.handle('hr:dashboard', () => service.dashboard())
}