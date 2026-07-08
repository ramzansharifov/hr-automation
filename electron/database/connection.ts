import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

let database: Database.Database | null = null

function createDatabaseConnection(): Database.Database {
  const databaseDirectory = path.join(app.getPath('userData'), 'database')

  mkdirSync(databaseDirectory, { recursive: true })

  const databasePath = path.join(databaseDirectory, 'hr-automation.sqlite')
  const connection = new Database(databasePath)

  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')

  return connection
}

export function getDatabase(): Database.Database {
  if (!database) {
    database = createDatabaseConnection()
  }

  return database
}