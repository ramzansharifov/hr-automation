import { app } from 'electron'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'

const foreignKeysOffMarker = '-- requires_foreign_keys_off'

export function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  const migrationsDirectory = resolveMigrationsDirectory()

  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort()

  const applyMigrationInTransaction = database.transaction((fileName: string, sql: string) => {
    database.exec(sql)
    insertAppliedMigration(database, fileName)
  })

  for (const fileName of migrationFiles) {
    const appliedMigration = database
      .prepare('SELECT id FROM schema_migrations WHERE name = ? LIMIT 1')
      .get(fileName)

    if (appliedMigration) {
      continue
    }

    const filePath = path.join(migrationsDirectory, fileName)
    const sql = readFileSync(filePath, 'utf8')

    try {
      applyMigration(database, fileName, sql, applyMigrationInTransaction)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      throw new Error(`Не удалось применить миграцию ${fileName}: ${message}`)
    }
  }
}

function applyMigration(
  database: Database.Database,
  fileName: string,
  sql: string,
  applyMigrationInTransaction: (fileName: string, sql: string) => void,
): void {
  const shouldDisableForeignKeys = sql.includes(foreignKeysOffMarker)

  if (!shouldDisableForeignKeys) {
    applyMigrationInTransaction(fileName, sql)
    return
  }

  database.pragma('foreign_keys = OFF')

  try {
    applyMigrationInTransaction(fileName, sql)
    const foreignKeyErrors = database.pragma('foreign_key_check') as unknown[]

    if (foreignKeyErrors.length > 0) {
      throw new Error(`Foreign key check failed after ${fileName}`)
    }
  } finally {
    database.pragma('foreign_keys = ON')
  }
}

function insertAppliedMigration(database: Database.Database, fileName: string): void {
  database
    .prepare(
      `
      INSERT INTO schema_migrations (name)
      VALUES (?)
    `,
    )
    .run(fileName)
}

function resolveMigrationsDirectory(): string {
  const candidates = [
    path.join(process.resourcesPath, 'migrations'),
    path.join(app.getAppPath(), 'electron/migrations'),
    path.join(process.cwd(), 'electron/migrations'),
  ]

  const migrationsDirectory = candidates.find((candidate) => existsSync(candidate))

  if (!migrationsDirectory) {
    throw new Error(`Каталог миграций не найден. Проверены пути: ${candidates.join(', ')}`)
  }

  return migrationsDirectory
}
