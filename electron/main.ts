import { app, BrowserWindow, shell } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { initializeDatabase } from './database'
import { registerHrCrudIpcHandlers } from './ipc/hrCrudIpc'
import { registerAccessIpcHandlers } from './ipc/accessIpc'
import { registerBusinessContextIpcHandlers } from './ipc/businessContextIpc'
import { registerDocumentTypesIpcHandlers } from './ipc/documentTypesIpc'
import { registerEmployeeDocumentsIpcHandlers } from './ipc/employeeDocumentsIpc'
import { registerEmployeeWorkspaceIpcHandlers } from './ipc/employeeWorkspaceIpc'
import { registerEnterpriseTenantIpcHandlers } from './ipc/enterpriseTenantIpc'
import { registerHrCoreExpansionIpcHandlers } from './ipc/hrCoreExpansionIpc'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    show: process.env.HR_E2E !== '1',
    autoHideMenuBar: true,
    icon: path.join(process.env.VITE_PUBLIC, 'hr-logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.once('ready-to-show', () => {
    if (process.env.HR_E2E !== '1') win?.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    try {
      const protocol = new URL(details.url).protocol
      if (protocol === 'https:' || protocol === 'http:') {
        void shell.openExternal(details.url)
      }
    } catch {
      // Invalid URLs are ignored.
    }
    return { action: 'deny' }
  })

  if (process.env.HR_E2E === '1') {
    win.webContents.once('did-finish-load', async () => {
      try {
        const result = await win?.webContents.executeJavaScript(`(async () => {
          const hasRoot = Boolean(document.querySelector('#root'))
          const hasApi = Boolean(window.hrApi)
          if (!hasRoot || !hasApi) return { hasRoot, hasApi }

          const initialPassword = 'superadmin'
          const e2ePassword = 'E2E-Superadmin-2026!'
          let session = await window.hrApi.login({
            username: 'superadmin',
            password: initialPassword
          })

          if (session?.mustChangePassword) {
            await window.hrApi.changeOwnPassword({
              currentPassword: initialPassword,
              newPassword: e2ePassword
            })
            await window.hrApi.logout()
            session = await window.hrApi.login({
              username: 'superadmin',
              password: e2ePassword
            })
          }

          let enterpriseRequiredOnEmployee = false
          try {
            await window.hrApi.create({
              entity: 'employees',
              data: {
                last_name: 'Без',
                first_name: 'Предприятия',
                hire_date: '2026-01-01',
                salary: 0,
                status: 'active'
              }
            })
          } catch {
            enterpriseRequiredOnEmployee = true
          }

          let businessContext = await window.hrApi.getBusinessContext()
          let contextRequired = false
          let scopeModelReady = false
          let employeeOwnershipReady = false
          let e2eEnterpriseId = 0
          let e2eDepartmentId = 0
          let e2eEmployeeId = 0
          let foreignDepartmentId = 0

          if (businessContext?.requiresEnterpriseSelection && !businessContext.enterpriseId) {
            try {
              await window.hrApi.dashboard()
            } catch {
              contextRequired = true
            }

            const enterprise = await window.hrApi.create({
              entity: 'enterprises',
              data: {
                name: 'E2E Enterprise',
                legal_form: 'ООО',
                legal_name: 'E2E Enterprise',
                registration_number: 'E2E-001',
                phone: '+992000000000',
                email: 'e2e@example.test',
                address: 'E2E'
              }
            })
            e2eEnterpriseId = Number(enterprise.id)
            businessContext = await window.hrApi.setBusinessContext({
              enterpriseId: e2eEnterpriseId,
              departmentId: null
            })

            const department = await window.hrApi.create({
              entity: 'departments',
              data: {
                enterprise_id: e2eEnterpriseId,
                name: 'E2E Department'
              }
            })
            e2eDepartmentId = Number(department.id)

            const foreignDepartment = await window.hrApi.create({
              entity: 'departments',
              data: {
                enterprise_id: e2eEnterpriseId,
                name: 'E2E Foreign Department'
              }
            })
            foreignDepartmentId = Number(foreignDepartment.id)

            const position = await window.hrApi.create({
              entity: 'positions',
              data: {
                department_id: e2eDepartmentId,
                name: 'E2E Position'
              }
            })
            const employee = await window.hrApi.create({
              entity: 'employees',
              data: {
                enterprise_id: e2eEnterpriseId,
                department_id: e2eDepartmentId,
                position_id: Number(position.id),
                last_name: 'Тестов',
                first_name: 'Сотрудник',
                hire_date: '2026-01-01',
                salary: 1000,
                status: 'active'
              }
            })
            e2eEmployeeId = Number(employee.id)
            employeeOwnershipReady = Number(employee.enterprise_id) === e2eEnterpriseId

            businessContext = await window.hrApi.setBusinessContext({
              enterpriseId: e2eEnterpriseId,
              departmentId: e2eDepartmentId
            })

            const scopedAuthState = await window.hrApi.getAuthState()
            const scopes = scopedAuthState?.session?.permissionScopes ?? {}
            scopeModelReady =
              scopes['employees.view'] === 'global' &&
              scopes['analytics.view'] === 'department' &&
              scopes['vacation_types.create'] === 'enterprise' &&
              scopes['document_types.create'] === 'enterprise'
          }

          const dashboard = await window.hrApi.dashboard()
          const attention = await window.hrApi.listAttentionItems()
          const analytics = await window.hrApi.getAnalytics()
          const documentTypes = await window.hrApi.listDocumentTypes()
          const obsoleteLeaveApiRemoved =
            typeof window.hrApi.getLeaveOverview === 'undefined' &&
            typeof window.hrApi.saveLeaveBalance === 'undefined' &&
            typeof window.hrApi.saveWorkCalendarDay === 'undefined'

          let customRoleScopeReady = false
          let customRoleCrudReady = false
          let customRoleDeleteDenied = false
          let customRoleForeignScopeDenied = false
          let customRoleDepartmentEditDenied = false
          let customRoleEducationReady = false
          let customRoleEducationEditDenied = false

          if (
            e2eEnterpriseId > 0 &&
            e2eDepartmentId > 0 &&
            e2eEmployeeId > 0 &&
            foreignDepartmentId > 0
          ) {
            const customRole = await window.hrApi.saveAccessRole({
              name: 'E2E Department Editor',
              description: 'Granular RBAC smoke role',
              scopeType: 'department',
              enterpriseId: e2eEnterpriseId,
              departmentId: e2eDepartmentId,
              permissionCodes: [
                'positions.create',
                'positions.edit',
                'employee_education.create'
              ]
            })

            customRoleScopeReady =
              customRole?.scopeType === 'department' &&
              Number(customRole?.enterpriseId) === e2eEnterpriseId &&
              Number(customRole?.departmentId) === e2eDepartmentId &&
              customRole?.permissionCodes?.includes('enterprises.view') &&
              customRole?.permissionCodes?.includes('departments.view') &&
              customRole?.permissionCodes?.includes('positions.view') &&
              customRole?.permissionCodes?.includes('positions.create') &&
              customRole?.permissionCodes?.includes('positions.edit') &&
              !customRole?.permissionCodes?.includes('positions.delete') &&
              customRole?.permissionCodes?.includes('employees.view') &&
              customRole?.permissionCodes?.includes('employee_education.view') &&
              customRole?.permissionCodes?.includes('employee_education.create') &&
              !customRole?.permissionCodes?.includes('employee_education.edit')

            const customPassword = 'E2E-Role-2026!'
            await window.hrApi.saveAccessUser({
              employeeId: e2eEmployeeId,
              username: 'e2e.department.editor',
              status: 'active',
              roleIds: [Number(customRole.id)],
              password: customPassword,
              mustChangePassword: false
            })

            await window.hrApi.logout()
            const customSession = await window.hrApi.login({
              username: 'e2e.department.editor',
              password: customPassword
            })
            const customScopes = customSession?.permissionScopes ?? {}
            customRoleScopeReady =
              customRoleScopeReady &&
              customSession?.username === 'e2e.department.editor' &&
              customSession?.scopeType === 'department' &&
              Number(customSession?.enterpriseId) === e2eEnterpriseId &&
              Number(customSession?.departmentId) === e2eDepartmentId &&
              customScopes['positions.create'] === 'department' &&
              customScopes['positions.edit'] === 'department' &&
              typeof customScopes['positions.delete'] === 'undefined' &&
              customScopes['employee_education.create'] === 'department' &&
              typeof customScopes['employee_education.edit'] === 'undefined'

            const visiblePositions = await window.hrApi.list({
              entity: 'positions',
              page: 1,
              pageSize: 100,
              orderBy: 'name',
              orderDirection: 'asc'
            })
            const positionScopeReady =
              Array.isArray(visiblePositions?.items) &&
              visiblePositions.items.length > 0 &&
              visiblePositions.items.every(
                (item) => Number(item.department_id) === e2eDepartmentId
              )

            const createdPosition = await window.hrApi.create({
              entity: 'positions',
              data: {
                department_id: e2eDepartmentId,
                name: 'E2E Scoped Position'
              }
            })
            const updatedPosition = await window.hrApi.update({
              entity: 'positions',
              id: Number(createdPosition.id),
              data: {
                department_id: e2eDepartmentId,
                name: 'E2E Scoped Position Updated'
              }
            })
            customRoleCrudReady =
              positionScopeReady &&
              Number(createdPosition.department_id) === e2eDepartmentId &&
              updatedPosition?.name === 'E2E Scoped Position Updated'

            try {
              await window.hrApi.delete({
                entity: 'positions',
                id: Number(createdPosition.id)
              })
            } catch {
              customRoleDeleteDenied = true
            }

            try {
              await window.hrApi.create({
                entity: 'positions',
                data: {
                  department_id: foreignDepartmentId,
                  name: 'E2E Forbidden Position'
                }
              })
            } catch {
              customRoleForeignScopeDenied = true
            }

            try {
              await window.hrApi.update({
                entity: 'departments',
                id: e2eDepartmentId,
                data: {
                  enterprise_id: e2eEnterpriseId,
                  name: 'E2E Forbidden Department Rename'
                }
              })
            } catch {
              customRoleDepartmentEditDenied = true
            }

            const education = await window.hrApi.create({
              entity: 'employee_education',
              data: {
                employee_id: e2eEmployeeId,
                education_type: 'higher',
                education_degree: 'bachelor',
                institution_name: 'E2E Academy',
                speciality: 'Software Engineering',
                started_at: '2020-09-01',
                ended_at: '2024-06-30',
                document_number: 'E2E-EDU-001'
              }
            })
            customRoleEducationReady =
              Number(education?.employee_id) === e2eEmployeeId &&
              education?.institution_name === 'E2E Academy'

            try {
              await window.hrApi.update({
                entity: 'employee_education',
                id: Number(education.id),
                data: {
                  employee_id: e2eEmployeeId,
                  education_type: 'higher',
                  education_degree: 'master',
                  institution_name: 'E2E Academy'
                }
              })
            } catch {
              customRoleEducationEditDenied = true
            }
          }

          return {
            hasRoot,
            hasApi,
            authenticated:
              session?.username === 'superadmin' && session?.mustChangePassword === false,
            enterpriseRequiredOnEmployee,
            contextRequired,
            contextReady: Boolean(businessContext?.enterpriseId && businessContext?.departmentId),
            scopeModelReady,
            employeeOwnershipReady,
            obsoleteLeaveApiRemoved,
            dashboardReady: typeof dashboard?.employeesTotal === 'number',
            attentionReady: Array.isArray(attention),
            analyticsReady: Boolean(analytics && typeof analytics === 'object'),
            documentTypesReady:
              Array.isArray(documentTypes) &&
              documentTypes.length >= 6 &&
              documentTypes.every((type) => type.enterpriseId === businessContext.enterpriseId),
            customRoleScopeReady,
            customRoleCrudReady,
            customRoleDeleteDenied,
            customRoleForeignScopeDenied,
            customRoleDepartmentEditDenied,
            customRoleEducationReady,
            customRoleEducationEditDenied
          }
        })()`)

        if (
          !result?.hasRoot ||
          !result?.hasApi ||
          !result?.authenticated ||
          !result?.enterpriseRequiredOnEmployee ||
          !result?.contextRequired ||
          !result?.contextReady ||
          !result?.scopeModelReady ||
          !result?.employeeOwnershipReady ||
          !result?.obsoleteLeaveApiRemoved ||
          !result?.dashboardReady ||
          !result?.attentionReady ||
          !result?.analyticsReady ||
          !result?.documentTypesReady ||
          !result?.customRoleScopeReady ||
          !result?.customRoleCrudReady ||
          !result?.customRoleDeleteDenied ||
          !result?.customRoleForeignScopeDenied ||
          !result?.customRoleDepartmentEditDenied ||
          !result?.customRoleEducationReady ||
          !result?.customRoleEducationEditDenied
        ) {
          throw new Error(`Renderer HR core smoke check failed: ${JSON.stringify(result)}`)
        }

        console.log('HR_E2E_RENDERER_OK')
        app.exit(0)
      } catch (error) {
        console.error('HR_E2E_RENDERER_FAILED', error)
        app.exit(1)
      }
    })
  }

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.hr.automation')

  if (process.env.HR_E2E === '1') {
    app.setPath('userData', path.join(app.getPath('temp'), `hr-automation-e2e-${process.pid}`))
  }

  initializeDatabase()
  registerHrCrudIpcHandlers()
  registerBusinessContextIpcHandlers()
  registerEmployeeWorkspaceIpcHandlers()
  registerAccessIpcHandlers()
  registerEnterpriseTenantIpcHandlers()
  registerHrCoreExpansionIpcHandlers()
  registerDocumentTypesIpcHandlers()
  registerEmployeeDocumentsIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})
