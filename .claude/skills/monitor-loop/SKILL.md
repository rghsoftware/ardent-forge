---
name: monitor-loop
description: Spawn background sub-agents and coordinate them via the Monitor tool and an event log, instead of blocking on TaskOutput.
---

# Monitor Loop Pattern

`/impl` and `/team-impl` use this pattern to run specialist sub-agents in parallel without blocking the orchestrator's context on `TaskOutput` dumps.

## Why

`TaskOutput({block: true, timeout: 300000})` pulls the full agent transcript into the orchestrator's context window. That serialises waves (orchestrator stays hot while each agent runs), bloats the central window with chatter, and makes parallel execution practically impossible on a Sonnet orchestrator.

The Monitor tool solves both problems:
- Sub-agents run with `run_in_background: true`; the orchestrator proceeds.
- Sub-agents append short structured lines to `.cortex/events.log`.
- A `Monitor` on that log fires one notification per matching line — the orchestrator sees only discrete events (`task_done`, `contract_ready`, `milestone_reached`, `error`).
- The full sub-agent transcript stays out of the orchestrator's context. If an error fires, only then does the orchestrator pull that single agent's `TaskOutput` for triage.

## Preconditions

- `.claude/hooks/event-log/event-log.ts` exists (it does) and is executable via `bun run`.
- The orchestrator has `Task`, `Monitor`, and `Bash` available.
- Sub-agent prompts include an explicit instruction to append events at task-complete and contract-ready moments.

## Event shape

Lines in `.cortex/events.log` are NDJSON, one per line, matching this TypeScript shape:

```ts
interface EventEntry {
  ts: string;                   // ISO-8601 timestamp
  source: string;               // agent name, e.g. "builder-api"
  type: "task_done" | "contract_ready" | "milestone_reached" | "error" | "note";
  task?: string;                // S### task id when applicable
  contract?: string;            // absolute or project-relative path
  note?: string;                // free-text context, optional
}
```

## Sub-agent instruction (paste into every specialist prompt)

```text
When you finish a task assigned to you, run:
  bun run .claude/hooks/event-log/event-log.ts append --source <your-name> --type task_done --task <S-id>

When you write a contract file that downstream agents will consume
(a file path listed in the Steps.md milestone Contracts section), run:
  bun run .claude/hooks/event-log/event-log.ts append --source <your-name> --type contract_ready --contract <file-path>

If you hit an unrecoverable blocker, run:
  bun run .claude/hooks/event-log/event-log.ts append --source <your-name> --type error --note "<short reason>"

Do NOT emit events for routine tool calls. The event log is for milestones only.
```

## Orchestrator flow

1. **Initialise the log.** Before spawning any wave, ensure the file exists so `tail -F` can start cleanly:
   ```bash
   mkdir -p .cortex && : > .cortex/events.log
   ```
   Truncating is safe here — `/impl` writes a fresh log per feature run, and `.claude/hooks/context-recovery/backup-core.ts` already preserved the prior session's log in the backup.

2. **Spawn the wave in the background.** For every task in the current wave that has its upstream contracts satisfied, render the specialist prompt to `.cortex/prompts/<task>.md` and call:
   ```ts
   Task({
     description: "S002: Build API layer",
     prompt: "<contents of .cortex/prompts/S002.md>",
     subagent_type: "general-purpose",
     run_in_background: true,
   });
   ```
   All parallel tasks in the wave go out in a single message, back-to-back.

3. **Start the Monitor.** Immediately after spawning:
   ```ts
   Monitor({
     description: "cortex events: task_done, contract_ready, milestone_reached, error",
     command: `tail -n 0 -F .cortex/events.log | grep --line-buffered -E '"type":"task_done"|"type":"contract_ready"|"type":"milestone_reached"|"type":"error"'`,
     timeout_ms: 3600000,
     persistent: false,
   });
   ```
   Notes:
   - `tail -n 0` skips the existing contents so we only see new events.
   - `tail -F` (capital F) retries if the file is missing or rotated.
   - `grep --line-buffered` is mandatory — default pipe buffering delays events by minutes.
   - The pattern matches on `"type":"<value>"` so a free-text `note` field containing the word `error` will not trigger a false positive.
   - `timeout_ms` is 1 hour — waves longer than that likely indicate a stalled agent anyway.

4. **React to events, do not poll.** Every matching event arrives as a chat notification. When a `task_done` event lands, mark the corresponding TaskUpdate row `completed`. When a `contract_ready` event lands, read that file and prepare it for injection into the next wave. When an `error` event lands, pull that single agent's full output via `TaskOutput({task_id, block: false})` for triage.

5. **Wave-complete condition.** A wave is complete when the expected set of `task_done` events for that wave have arrived. Maintain a small in-memory checklist against the planned Steps.md task list. Do NOT call `TaskOutput` on agents that emitted `task_done` — the event is authoritative.

6. **Safety net for silent agents.** If an expected `task_done` has not arrived by some reasonable deadline (default: 10 minutes per task unless Steps.md says otherwise), pull that one agent's `TaskOutput` non-blocking and inspect it. Treat missing events as a bug in the specialist prompt rather than a routine situation.

7. **Shut down the Monitor.** Once every wave is complete and the milestone checkpoints have passed, call `TaskStop` on the Monitor task_id or let it time out.

## What this pattern is not

- **Not a replacement for milestone drift checks.** Events are throughput signals, not quality signals. The orchestrator still runs `stub detection`, `contract extraction`, and `drift checkpoint` at each milestone boundary.
- **Not a replacement for TaskOutput on failure.** When an agent reports `error`, or when an expected `task_done` never arrives, the orchestrator pulls that single agent's output. The point is to avoid pulling output on the happy path.
- **Not a messaging bus between agents.** Agents do not read the event log to communicate with each other. Only the orchestrator consumes it. For cross-agent contract handoff, use Steps.md milestone Contracts — same as before.

## Failure modes and mitigations

| Failure | Mitigation |
|---|---|
| Specialist forgets to emit `task_done` | Safety-net timeout pulls its TaskOutput; orchestrator updates the prompt template if this recurs. |
| Monitor filter too tight, real events missed | The filter is single source of truth for event types. Keep it in sync with the `EventType` union in `.claude/hooks/event-log/event-log.ts`. |
| Monitor filter too loose, notification flood | Monitor auto-stops on excessive volume. Restart with a tighter regex. |
| Event log grows across sessions | `/impl` truncates at start; `backup-core.ts` archives the prior log before truncation. |
| Agent emits event with malformed JSON | Unlikely — agents call `event-log.ts append`, which builds the JSON. Direct `echo >> events.log` by agents is discouraged. |
