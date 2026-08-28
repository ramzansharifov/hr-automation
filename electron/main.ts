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
            const enterpriseId = Number(enterprise.id)
            businessContext = await window.hrApi.setBusinessContext({
              enterpriseId,
              departmentId: null
            })

            const department = await window.hrApi.create({
              entity: 'departments',
              data: {
                enterprise_id: enterpriseId,
                name: 'E2E Department'
              }
            })
            const departmentId = Number(department.id)
            const position = await window.hrApi.create({
              entity: 'positions',
              data: {
                department_id: departmentId,
                name: 'E2E Position'
              }
            })
            const employee = await window.hrApi.create({
              entity: 'employees',
              data: {
                enterprise_id: enterpriseId,
                department_id: departmentId,
                position_id: Number(position.id),
                last_name: 'Тестов',
                first_name: 'Сотрудник',
                hire_date: '2026-01-01',
                salary: 1000,
                status: 'active'
              }
            })
            employeeOwnershipReady = Number(employee.enterprise_id) === enterpriseId

            businessContext = await window.hrApi.setBusinessContext({
              enterpriseId,
              departmentId
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
              documentTypes.every((type) => type.enterpriseId === businessContext.enterpriseId)
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
          !result?.documentTypesReady
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
