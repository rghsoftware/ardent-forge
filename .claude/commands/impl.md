---
description: Execute Steps.md via hub-and-spoke sub-agent orchestration
model: sonnet
effort: medium
---

# Implementation Orchestrator

Execute a planned feature by reading Steps.md and delegating tasks to specialist agents in waves defined by milestone boundaries. Specialists run in the background; the orchestrator coordinates through an event log (see `core/skills/monitor-loop/SKILL.md`) and consults the Advisor tool for strategic decisions.

## Workflow

**CRITICAL:** If $ARGUMENTS is empty, STOP and ask: "Which feature would you like to implement?" Do NOT search Context/Features/ until input is obtained.

### Step 1: Identify feature
1. If $ARGUMENTS is NOT empty:
   - Match against feature number (e.g., "005", "005-opencode-commands")
   - If not a match, treat as new feature description and suggest `/blueprint` or `/quick`
2. If $ARGUMENTS is empty:
   - Ask: "Which feature? (e.g., '005' or a feature description)"
   - Do NOT read any files until feature is specified
3. Once identified, load Steps.md

### Step 2: Load planning context
1. Read `Context/Features/NNN-FeatureName/Steps.md` -- this is the ONLY planning file the orchestrator reads
2. Parse Steps.md to extract:
   - Team Members (names, agent types, resume behavior)
   - Task list with assignments, dependencies, parallel flags
   - Milestones with testable assertion references and contract declarations
   - File ownership boundaries per agent

**Context budget rule:** Do NOT read Spec.md, Tech.md, CLAUDE.md, or any source code into the orchestrator's context. Agents read these files themselves. The orchestrator's job is coordination, not comprehension -- if it compacts before wave 1 starts, the entire execution plan is lost.

### Step 3: Initialize execution session
1. Create `.cortex/session.md` with plan reference and team roster
2. Truncate the event log so only this run's events appear:
   ```bash
   mkdir -p .cortex .cortex/prompts && : > .cortex/events.log
   ```
3. Create TaskCreate entries for each S### task in Steps.md
4. Set dependencies via `addBlockedBy` based on `Depends` fields
5. Assign owners based on `Assigned` fields
6. Update Steps.md Progress: Status = "In progress"

### Step 4: Build wave execution plan
Parse milestones to determine execution waves:
- **Wave 1**: All tasks before the first milestone
- **Wave 2**: All tasks between milestone 1 and milestone 2
- **Wave N**: Tasks between milestone N-1 and N
- Within each wave, group tasks by Parallel flag and dependency satisfaction

### Step 5: Execute waves

For each wave, use the background + Monitor pattern documented in `core/skills/monitor-loop/SKILL.md`. The steps below are the orchestrator-side flow; the skill has the full rationale and failure modes.

**5a. Render specialist prompts**
Write each task's prompt to `.cortex/prompts/<S-id>.md` using the Agent Prompt Template below. Keeping prompts in files (a) stops giant inline strings from bloating the orchestrator's turn, and (b) makes them recoverable if the orchestrator dies mid-wave.

**5b. Spawn the wave in the background**
In a single message, send one `Task({run_in_background: true})` call per parallel task in the wave. Each call's `prompt` field contains the file contents from `.cortex/prompts/<S-id>.md`. Sequential tasks in the wave spawn one-at-a-time after their upstream `task_done` events arrive.

**5c. Start the Monitor on events.log**
Immediately after spawning, call Monitor with a filter that matches only milestone events:

```ts
Monitor({
  description: "cortex events: task_done, contract_ready, milestone_reached, error",
  command: `tail -n 0 -F .cortex/events.log | grep --line-buffered -E '"type":"task_done"|"type":"contract_ready"|"type":"milestone_reached"|"type":"error"'`,
  timeout_ms: 3600000,
  persistent: false,
});
```

**5d. React to events**
- On `task_done` -- call `TaskUpdate({taskId, status: "completed"})`.
- On `contract_ready` -- read the contract file and stash its content for the next wave's prompts.
- On `milestone_reached` -- proceed to step 5e.
- On `error` -- pull that single agent's `TaskOutput({task_id, block: false})` for triage. Never pull output on the happy path.
- If an expected `task_done` is missing after a reasonable deadline (10 minutes per task by default), treat it as a silent failure and pull that agent's output.

**5e. Milestone checkpoint**
When all tasks before a milestone are complete:

1. **Stub detection** -- search completed files for:
   - `// TODO:` or `# TODO:` without `tracked in Steps.md S###`
   - `// FIXME:` or `# FIXME:`
   - `pass` as sole function body (Python)
   - `todo!()` or `unimplemented!()` (Rust)
   - `throw NotImplementedError` or `throw new Error("not implemented")`
   - Empty method/function bodies

2. **Verify test/doc tasks** -- check that all `S###-T` and `S###-D` tasks before this milestone are completed

3. **Contract extraction** -- for each file path listed under the milestone's Contracts:
   - Read the file content
   - If file does not exist, flag as milestone failure and stop
   - Store the content for injection into next wave's agent prompts
   - Log the delivery to `.cortex/session.md`

4. **Drift checkpoint with Advisor consult** -- pull the Testable Assertions referenced in the milestone from Spec.md. Write a question file and consult the Advisor:

   ```bash
   cat > /tmp/cortex-drift-<milestone>.md <<'EOF'
   The following Spec.md testable assertions are attached to this milestone:
   [assertion IDs and text]

   The following files were produced by the wave:
   [list of changed files with short content excerpts]

   Question: for each assertion, is the implementation (a) aligned,
   (b) diverged and needs an ADR, or (c) diverged because the spec was wrong?
   Respond as enumerated bullets, one per assertion.
   EOF

   bun run .claude/hooks/advisor/advisor-cli.ts --question-file /tmp/cortex-drift-<milestone>.md
   ```

   - Exit 0: present the Advisor's enumerated verdict alongside each assertion and ask the user to confirm.
   - Exit 2: the Advisor is unavailable. Fall back to in-thread reasoning -- present the assertions yourself and ask.

   For each assertion, the user picks:
   - **Aligned** -- proceed to next wave
   - **Diverged, need ADR** -- pause, create ADR documenting the deviation
   - **Diverged, spec was wrong** -- update Spec.md with revision history entry

5. Update Steps.md Progress section with last completed milestone

6. **Continue to next wave** with extracted contracts injected into the next wave's prompt files

### Step 6: Final validation
After all waves complete:
1. Dispatch quality-engineer in validation mode
2. Run all Validation Commands from Steps.md
3. Verify all Acceptance Criteria
4. Report PASS/FAIL per criterion

### Step 7: Complete
1. Stop the Monitor via `TaskStop` (or let it time out on its own)
2. Update Steps.md Progress: Status = "Complete"
3. Run Validation Commands and capture results
4. Archive `.cortex/session.md` to `.cortex/archive/`
5. `.cortex/events.log` stays in place until the next `/impl` run truncates it. `backup-core.ts` will pick it up in any backup snapshot.
6. Present completion report
7. Suggest next steps:
   - Run `/qa` for parallel stack-specific quality checks
   - Run `/review-capture` to capture findings
   - Run `/commit` when ready

## Agent Prompt Template

When rendering each agent's prompt file, use this template. The orchestrator fills in task IDs, file paths, and milestone references from Steps.md -- it does NOT read Spec.md/Tech.md to paste content. Agents read those files themselves.

```
You are [NAME], the [ROLE] on this team.

FEATURE CONTEXT:
Read these files before starting work (focus on sections relevant to your tasks):
- Context/Features/NNN-FeatureName/Spec.md -- requirements and testable assertions
- Context/Features/NNN-FeatureName/Tech.md -- architecture decisions
- CLAUDE.md -- project conventions

YOUR TASKS:
[List specific tasks from Steps.md assigned to this agent]

FILES YOU OWN (only modify these):
[Explicit list of files/directories this agent may touch]

UPSTREAM CONTRACTS (your inputs):
[Paste actual file content extracted at the milestone boundary]
[If Wave 1 agent: "None -- you are producing the foundation"]

CONTRACTS YOU MUST PRODUCE (your outputs):
[What downstream agents need from you, from the next milestone's Contracts]
[If final wave: "None -- you are consuming, not producing"]

COORDINATION (event log):
- When you finish a task, run:
    bun run .claude/hooks/event-log/event-log.ts append --source [NAME] --type task_done --task <S-id>
- When you write a contract file listed in the milestone Contracts, run:
    bun run .claude/hooks/event-log/event-log.ts append --source [NAME] --type contract_ready --contract <file-path>
- If you hit a blocker you cannot resolve, run:
    bun run .claude/hooks/event-log/event-log.ts append --source [NAME] --type error --note "<short reason>"
- Do NOT emit events for routine tool calls. The log is for milestones only.

FILE OWNERSHIP RULES:
- Mark your tasks complete via TaskUpdate when done
- If you change an interface another agent depends on, note it clearly in `.cortex/session.md`

Think hard and provide thorough implementation.
```

## Orchestration Tools Reference

### Creating and managing tasks

```typescript
// Create a task for each S### entry in Steps.md
TaskCreate({
  subject: "S001: Set up database schema",
  description: "Create migration files for user and session tables. See Steps.md S001.",
  activeForm: "Setting up database schema",
});

// Set dependencies from Steps.md Depends fields
TaskUpdate({
  taskId: "2",
  addBlockedBy: ["1"],
});

// Assign owner from Steps.md Assigned fields
TaskUpdate({
  taskId: "1",
  owner: "builder-api",
});

// Mark complete when the matching task_done event arrives
TaskUpdate({
  taskId: "1",
  status: "completed",
});

// Check progress across all tasks
TaskList({});
```

### Spawning agents in the background

Sub-agents run on Sonnet. Specialists execute against a detailed prompt file (spec/tech excerpts, file ownership, upstream contracts, a concrete task list) -- that's execution work, not design work. The design decisions already happened upstream in `/blueprint`, and the milestone drift check (which consults the Advisor tool for an Opus verdict) plus the final quality-engineer validation run catch any misalignment. Set `model: "sonnet"` explicitly so future readers don't have to trace orchestrator inheritance.

```typescript
// All parallel tasks in the wave spawn in a single message
Task({
  description: "S002: Build API layer",
  prompt: "<contents of .cortex/prompts/S002.md>",
  subagent_type: "general-purpose",
  model: "sonnet",
  run_in_background: true,
});
Task({
  description: "S003: Build UI layer",
  prompt: "<contents of .cortex/prompts/S003.md>",
  subagent_type: "general-purpose",
  model: "sonnet",
  run_in_background: true,
});
```

### Monitoring the wave via the event log

```typescript
Monitor({
  description: "cortex events: task_done, contract_ready, milestone_reached, error",
  command: `tail -n 0 -F .cortex/events.log | grep --line-buffered -E '"type":"task_done"|"type":"contract_ready"|"type":"milestone_reached"|"type":"error"'`,
  timeout_ms: 3600000,
  persistent: false,
});

// On error events only, pull that one agent's output for triage:
TaskOutput({ task_id: "agentId", block: false, timeout: 5000 });
```

Never block on `TaskOutput` on the happy path. The event log is the authoritative wave-progress signal.

### Consulting the Advisor at milestones

```bash
# Write a question file with assertions + evidence, then consult the Advisor
cat > /tmp/cortex-drift-m1.md <<'EOF'
[assertion IDs and text]
[list of changed files]
Question: aligned, diverged-need-ADR, or diverged-spec-wrong per assertion?
EOF

bun run .claude/hooks/advisor/advisor-cli.ts --question-file /tmp/cortex-drift-m1.md
# Exit 0 -> stdout has the enumerated verdict
# Exit 2 -> Advisor unavailable; fall back to in-thread reasoning
```

### Resuming agents

When an agent needs follow-up work (e.g., milestone corrections), resume it to preserve context:

```typescript
Task({
  description: "S001: Fix schema validation",
  prompt: "The milestone check found a missing index. Add it to...",
  subagent_type: "general-purpose",
  resume: "abc123",
});
```

When to resume vs start fresh:
- **Resume**: Continuing related work where the agent needs prior context
- **Fresh**: Unrelated task or clean slate preferred

## Rules
- Never skip milestone checkpoints -- they are not optional
- Never pull `TaskOutput` on the happy path -- events are authoritative
- Set `model: "sonnet"` explicitly on spawned sub-agent `Task()` calls. Specialists execute a well-specified plan; Opus-rate reasoning is reserved for the Advisor tool at milestone boundaries.
- If a task reveals the plan is wrong, pause and discuss with the user
- If context window is filling up, save progress to Steps.md and `.cortex/session.md`
- Parallel agents must not modify the same files
- Contract files must exist before downstream agents are spawned
- The quality-engineer always runs last in validation mode (read-only)
- Advisor-cli exit code 2 means fall back to in-thread reasoning -- never fail the wave on advisor unavailability
- **The orchestrator must NOT read source code, explore the codebase, or load files beyond Steps.md.** Codebase comprehension is the agents' job. The orchestrator reads Steps.md, builds prompt files, spawns agents, and monitors events. Any additional file reads risk compaction before wave 1.
- **No pre-flight advisor consult.** The advisor is called at milestone boundaries (Step 5e), not before wave 1. Pre-flight exploration and advisor calls are the two largest sources of unnecessary orchestrator context.
