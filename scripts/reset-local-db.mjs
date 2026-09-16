import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function userDataCandidates() {
  const home = os.homedir();

  if (process.platform === "win32") {
    const appData =
      process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
    return [
      path.join(appData, "hr-automation"),
      path.join(appData, "HR Automation"),
    ];
  }

  if (process.platform === "darwin") {
    const applicationSupport = path.join(home, "Library", "Application Support");
    return [
      path.join(applicationSupport, "hr-automation"),
      path.join(applicationSupport, "HR Automation"),
    ];
  }

  const configRoot =
    process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");
  return [
    path.join(configRoot, "hr-automation"),
    path.join(configRoot, "HR Automation"),
  ];
}

const databaseNames = [
  "hr-automation.sqlite",
  "hr-automation.sqlite-wal",
  "hr-automation.sqlite-shm",
];

const candidateRoots = [...new Set(userDataCandidates())];
const existingRoots = candidateRoots.filter((root) =>
  databaseNames.some((name) => existsSync(path.join(root, "database", name))),
);

if (existingRoots.length === 0) {
  console.log("Локальная база HR Automation не найдена.");
  console.log("Проверены пути:");
  candidateRoots.forEach((root) => console.log(`  - ${root}`));
  process.exit(0);
}

console.log("Будут удалены только файлы локальной SQLite-базы.");
console.log("Резервные копии и employee-documents не затрагиваются.");

for (const root of existingRoots) {
  const databaseDirectory = path.join(root, "database");
  console.log(`\n${databaseDirectory}`);

  for (const name of databaseNames) {
    const filePath = path.join(databaseDirectory, name);
    if (!existsSync(filePath)) continue;

    try {
      rmSync(filePath, { force: true });
      console.log(`  удалён: ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  не удалось удалить ${name}: ${message}`);
      console.error(
        "  Закройте HR Automation и все процессы Electron, затем повторите npm run db:reset.",
      );
      process.exitCode = 1;
    }
  }
}

if (!process.exitCode) {
  console.log(
    "\nГотово. При следующем запуске приложение создаст чистую схему через миграции.",
  );
  console.log(
    "Встроенная системная учётная запись superadmin будет создана миграцией автоматически.",
  );
}
