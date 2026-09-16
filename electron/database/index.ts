import { app } from 'electron'
import { getDatabase } from './connection'
import { runMigrations } from './migrations'
import { seedDatabase } from '../seed/seedDatabase'

export function initializeDatabase(): void {
  const database = getDatabase()
  runMigrations(database)

  if (!app.isPackaged && process.env.HR_SEED_DEMO === '1') {
    seedDatabase(database)
  }
}
