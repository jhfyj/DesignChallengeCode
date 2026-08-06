import { readFileSync, existsSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const weeksDir = join(rootDir, "weeks");
const configPath = join(rootDir, "week.config.json");

function resolveWeekArg() {
  const arg = process.argv.find((a) => a.startsWith("--week="));
  return arg ? arg.split("=")[1] : null;
}

function resolveWeekFolder(weekArg) {
  const folders = readdirSync(weeksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (!weekArg) return folders;

  // Accept "2", "02", "week-02", or the full folder name.
  const padded = weekArg.padStart(2, "0");
  return folders.filter(
    (f) => f === weekArg || f.startsWith(`week-${padded}`) || f.startsWith(`week-${weekArg}`)
  );
}

const weekArg = resolveWeekArg();

let target;
if (weekArg) {
  const matches = resolveWeekFolder(weekArg);
  if (matches.length === 0) {
    console.error(`No week folder matches "--week=${weekArg}" in weeks/`);
    process.exit(1);
  }
  target = matches[0];
} else {
  if (!existsSync(configPath)) {
    console.error("week.config.json not found. Set one, or pass --week=<n>.");
    process.exit(1);
  }
  target = JSON.parse(readFileSync(configPath, "utf-8")).current;
}

const targetDir = join(weeksDir, target);
if (!existsSync(targetDir)) {
  console.error(`Week folder "${target}" does not exist at weeks/${target}`);
  process.exit(1);
}

console.log(`> Running dev server for weeks/${target}\n`);

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCmd, ["run", "dev", "--workspace", `weeks/${target}`], {
  stdio: "inherit",
  cwd: rootDir,
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
