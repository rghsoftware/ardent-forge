/**
 * PreCompact hook: Backup session state before context compaction.
 * Triggered by Claude Code before auto-compact or manual /compact.
 */
import { readFileSync } from "fs";
import { runBackup } from "./backup-core.ts";

try {
  const input = readFileSync(0, "utf-8");
  const data = JSON.parse(input) as {
    session_id: string;
    transcript_path: string;
    hook_event_name: string;
    trigger: "manual" | "auto";
  };

  const result = runBackup(
    data.session_id,
    `precompact_${data.trigger}`,
    data.transcript_path
  );

  if (result) {
    // Return additional context so Claude knows about the backup
    const output = {
      hookSpecificOutput: {
        hookEventName: "PreCompact",
        additionalContext: `Session backup saved to ${result}. After compaction, read this file to restore context.`,
      },
    };
    console.log(JSON.stringify(output));
  }

  process.exit(0);
} catch (err) {
  console.error("PreCompact backup error:", err);
  process.exit(1);
}
