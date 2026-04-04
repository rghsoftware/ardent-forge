/**
 * StatusLine hook: Monitors context usage and triggers backup at thresholds.
 * Runs on every status line update from Claude Code.
 */
import { readFileSync } from "fs";
import { runBackup, readState, writeState } from "./backup-core.ts";

interface StatusInput {
  session_id: string;
  transcript_path: string;
  free_until_compact?: number;
}

const THRESHOLDS = [30, 15, 5]; // Backup at these % remaining

try {
  const input = readFileSync(0, "utf-8");
  const data: StatusInput = JSON.parse(input);

  const contextPct = data.free_until_compact ?? 100;
  const state = readState();

  // Check if we've crossed a threshold
  const lastThreshold = state.lastBackupThreshold as number | null;
  let shouldBackup = false;
  let crossedThreshold: number | null = null;

  for (const threshold of THRESHOLDS) {
    if (contextPct <= threshold && (lastThreshold === null || lastThreshold > threshold)) {
      shouldBackup = true;
      crossedThreshold = threshold;
      break;
    }
  }

  if (shouldBackup && crossedThreshold !== null) {
    const result = runBackup(
      data.session_id,
      `crossed_${crossedThreshold}pct`,
      data.transcript_path,
      contextPct
    );

    if (result) {
      const updatedState = readState();
      updatedState.lastBackupThreshold = crossedThreshold;
      writeState(updatedState);
    }
  }

  // Output status line content
  const icon = contextPct <= 5 ? "!!" : contextPct <= 15 ? "!" : "";
  console.log(`Cortex ${icon} ${contextPct}%`);

  process.exit(0);
} catch (err) {
  console.error("StatusLine error:", err);
  process.exit(1);
}
