import { spawn } from "node:child_process";
import path from "node:path";

const electronExecutable = path.resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron.cmd" : "electron",
);

const child = spawn(electronExecutable, ["."], {
  env: { ...process.env, HR_E2E: "1" },
  stdio: "inherit",
  shell: process.platform === "win32",
});

const timeout = setTimeout(() => {
  console.error("Electron smoke test timed out");
  child.kill("SIGTERM");
}, 30_000);

child.on("error", (error) => {
  clearTimeout(timeout);
  console.error("Unable to start Electron smoke test", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  clearTimeout(timeout);
  if (signal) {
    console.error(`Electron smoke test terminated by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
