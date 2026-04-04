/**
 * Stop hook validator: Ensures a new file was created in the expected directory.
 * Used by /blueprint to verify Spec.md, Tech.md, or Steps.md was written.
 *
 * Usage: bun run validate-new-file.ts --directory Context/Features --extension .md
 */
import { readdirSync, statSync, existsSync } from "fs";
import { join, extname } from "path";

const args = process.argv.slice(2);
const dirIdx = args.indexOf("--directory");
const extIdx = args.indexOf("--extension");

const directory = dirIdx >= 0 ? args[dirIdx + 1] : null;
const extension = extIdx >= 0 ? args[extIdx + 1] : ".md";

if (!directory) {
  console.error("Missing --directory argument");
  process.exit(2);
}

if (!existsSync(directory)) {
  console.error(`Directory does not exist: ${directory}`);
  process.exit(2);
}

// Check for files modified in the last 5 minutes
const cutoff = Date.now() - 5 * 60 * 1000;
let found = false;

function scanDir(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else if (extname(entry.name) === extension) {
      const stat = statSync(full);
      if (stat.mtimeMs >= cutoff) {
        found = true;
        return;
      }
    }
  }
}

scanDir(directory);

if (!found) {
  console.error(`No new ${extension} file was created in ${directory}. The plan command must produce output files.`);
  process.exit(2);
}

process.exit(0);
