import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

let database: Database.Database | null = null

export function getDatabasePath(): string {
  const databaseDirectory = path.join(app.getPath('userData'), 'database')
  mkdirSync(databaseDirectory, { recursive: true })
  return path.join(databaseDirectory, 'hr-automation.sqlite')
}

function createDatabaseConnection(): Database.Database {
  const connection = new Database(getDatabasePath())
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  return connection
}

export function getDatabase(): Database.Database {
  if (!database) database = createDatabaseConnection()
  return database
}

export function closeDatabase(): void {
  if (!database) return
  database.pragma('wal_checkpoint(TRUNCATE)')
  database.close()
  database = null
}
