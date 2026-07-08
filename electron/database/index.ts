import { getDatabase } from './connection'
import { runMigrations } from './migrations'
import { seedDatabase } from '../seed/seedDatabase'

export function initializeDatabase(): void {
  const database = getDatabase()

  runMigrations(database)
  seedDatabase(database)
}