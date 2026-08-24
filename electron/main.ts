import { app, BrowserWindow, shell } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { initializeDatabase } from './database'
import { registerHrCrudIpcHandlers } from './ipc/hrCrudIpc'
import { registerAccessIpcHandlers } from './ipc/accessIpc'
import { registerEmployeeWorkspaceIpcHandlers } from './ipc/employeeWorkspaceIpc'
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
    show: false,
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
    win?.show()
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

  initializeDatabase()
  registerHrCrudIpcHandlers()
  registerEmployeeWorkspaceIpcHandlers()
  registerAccessIpcHandlers()

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
