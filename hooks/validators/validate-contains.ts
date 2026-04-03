/**
 * Stop hook validator: Ensures a file in the target directory contains required sections.
 * Used by /blueprint to verify Steps.md has Team Orchestration, Tasks, etc.
 *
 * Usage: bun run validate-contains.ts --directory Context/Features --extension .md
 *        --contains "## Team Orchestration" --contains "## Tasks"
 */
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, extname } from "path";

const args = process.argv.slice(2);
const dirIdx = args.indexOf("--directory");
const extIdx = args.indexOf("--extension");

const directory = dirIdx >= 0 ? args[dirIdx + 1] : null;
const extension = extIdx >= 0 ? args[extIdx + 1] : ".md";

const required: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--contains" && i + 1 < args.length) {
    required.push(args[i + 1]);
  }
}

if (!directory || required.length === 0) {
  console.error("Usage: --directory <dir> --extension <ext> --contains <text>");
  process.exit(2);
}

if (!existsSync(directory)) {
  console.error("Directory does not exist: " + directory);
  process.exit(2);
}

const cutoff = Date.now() - 5 * 60 * 1000;
let newestFile: string | null = null;
let newestTime = 0;

function scanDir(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) scanDir(full);
    else if (extname(entry.name) === extension) {
      const mtime = statSync(full).mtimeMs;
      if (mtime >= cutoff && mtime > newestTime) {
        newestFile = full;
        newestTime = mtime;
      }
    }
  }
}

scanDir(directory);

if (!newestFile) {
  console.error("No recently created " + extension + " file found in " + directory);
  process.exit(2);
}

const content = readFileSync(newestFile, "utf-8");
const missing = required.filter((section) => !content.includes(section));

if (missing.length > 0) {
  const missingList = missing.map((m) => "  - " + m).join("\n");
  console.error("File " + newestFile + " is missing required sections:\n" + missingList);
  process.exit(2);
}

process.exit(0);
