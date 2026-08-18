import { app, shell } from "electron";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import type { BackupInfo } from "../../src/shared/types/hr";
import {
  closeDatabase,
  getDatabase,
  getDatabasePath,
} from "../database/connection";

export class BackupService {
  getBackupsDirectory(): string {
    const directory = path.join(app.getPath("userData"), "backups");
    mkdirSync(directory, { recursive: true });
    return directory;
  }

  list(): BackupInfo[] {
    return readdirSync(this.getBackupsDirectory())
      .filter((name) => name.endsWith(".sqlite"))
      .map((name) => this.describe(name))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async create(): Promise<BackupInfo> {
    const name = `hr-automation-${backupTimestamp(new Date())}.sqlite`;
    const destination = path.join(this.getBackupsDirectory(), name);
    await getDatabase().backup(destination);
    this.trimOldBackups();
    return this.describe(name);
  }

  restore(name: string): { success: true } {
    const safeName = path.basename(name);
    if (safeName !== name || !safeName.endsWith(".sqlite")) {
      throw new Error("Некорректное имя резервной копии");
    }

    const source = path.join(this.getBackupsDirectory(), safeName);
    if (!existsSync(source)) throw new Error("Резервная копия не найдена");

    const databasePath = getDatabasePath();
    closeDatabase();
    copyFileSync(source, databasePath);
    rmSync(`${databasePath}-wal`, { force: true });
    rmSync(`${databasePath}-shm`, { force: true });

    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 250);

    return { success: true };
  }

  async openFolder(): Promise<{ success: true }> {
    const error = await shell.openPath(this.getBackupsDirectory());
    if (error) throw new Error(error);
    return { success: true };
  }

  private describe(name: string): BackupInfo {
    const stats = statSync(path.join(this.getBackupsDirectory(), name));
    return {
      name,
      createdAt: stats.mtime.toISOString(),
      sizeBytes: stats.size,
    };
  }

  private trimOldBackups(): void {
    const keepCount = Number(
      getDatabase()
        .prepare("SELECT value FROM system_settings WHERE key = 'backup.keep_count'")
        .pluck()
        .get() ?? 10,
    );
    const backups = this.list();
    backups.slice(Math.max(keepCount, 1)).forEach((backup) => {
      rmSync(path.join(this.getBackupsDirectory(), backup.name), { force: true });
    });
  }
}

function backupTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}
