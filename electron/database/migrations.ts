import { app } from 'electron'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'

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

  const applyMigration = database.transaction((fileName: string, sql: string) => {
    database.exec(sql)

    database
      .prepare(
        `
        INSERT INTO schema_migrations (name)
        VALUES (?)
      `,
      )
      .run(fileName)
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
      applyMigration(fileName, sql)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      throw new Error(`Не удалось применить миграцию ${fileName}: ${message}`)
    }
  }
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