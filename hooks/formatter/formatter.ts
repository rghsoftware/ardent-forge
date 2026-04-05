/**
 * PostToolUse hook (Write|Edit): Auto-format files after modification.
 * Runs appropriate formatter based on file extension.
 */
import { readFileSync, existsSync } from "fs";
import { extname } from "path";
import { execSync } from "child_process";

interface PostToolInput {
  hook_event_name: string;
  tool_name: string;
  tool_input: { file_path?: string; content?: string };
  tool_response: { filePath?: string; success?: boolean };
}

try {
  const input = readFileSync(0, "utf-8");
  const data: PostToolInput = JSON.parse(input);

  const filePath = data.tool_input?.file_path ?? data.tool_response?.filePath;
  if (!filePath || !existsSync(filePath)) {
    process.exit(0);
  }

  const ext = extname(filePath).toLowerCase();

  // Map extensions to formatters
  const formatters: Record<string, string> = {
    ".ts": "prettier --write",
    ".tsx": "prettier --write",
    ".js": "prettier --write",
    ".jsx": "prettier --write",
    ".json": "prettier --write",
    ".css": "prettier --write",
    ".scss": "prettier --write",
    ".html": "prettier --write",
    ".md": "prettier --write",
    ".yaml": "prettier --write",
    ".yml": "prettier --write",
    ".py": "ruff format",
    ".rs": "rustfmt",
    ".kt": "ktlint -F",
    ".kts": "ktlint -F",
    ".vue": "prettier --write",
    ".svelte": "prettier --write",
  };

  const formatter = formatters[ext];
  if (formatter) {
    try {
      execSync(`${formatter} "${filePath}"`, {
        timeout: 10000,
        stdio: "pipe",
      });
    } catch {
      // Formatter not installed or failed -- silently continue
    }
  }

  process.exit(0);
} catch (err) {
  // Non-blocking -- don't fail the tool use
  process.exit(0);
}
