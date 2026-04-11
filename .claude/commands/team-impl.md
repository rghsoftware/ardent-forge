---
description: Execute Steps.md via Agent Teams with peer-to-peer coordination
model: sonnet
---

# Team Implementation (Agent Teams)

Execute a planned feature using Claude Code's Agent Teams for peer-to-peer coordination. Unlike `/impl` (hub-and-spoke sub-agents), `/team-impl` spawns a coordinated team where agents communicate directly, share a task list, and collaborate in real-time. The team lead still uses the Monitor+event-log pattern (`core/skills/monitor-loop/SKILL.md`) for wave coordination and the Advisor tool for milestone drift decisions.

## When to use instead of /impl
- Cross-domain integration where agents need to share contracts in real-time
- Changes in one domain immediately affect another domain
- Agents need peer-to-peer coordination, not just sequential handoffs
- Real-time collaboration needed (costs 2-4x more tokens than /impl)

## Prerequisites
Agent Teams must be enabled. Verify `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set to `1`. If not enabled, STOP and instruct the user how to enable it, or fall back to `/impl`.

## Workflow

**CRITICAL:** If $ARGUMENTS is empty, STOP and ask which feature to implement.

### Step 1: Load plan (identical to /impl)
1. Identify feature from $ARGUMENTS
2. Read Steps.md, Spec.md, Tech.md, CLAUDE.md
3. Parse team members, task graph, milestones, contracts, acceptance criteria

### Step 2: Contract chain analysis
Analyze the task dependency graph to determine spawning order:

1. **Identify waves** -- group tasks by dependency depth:
   - Wave 1: Tasks with `Depends: none` (foundation, spawn first)
   - Wave 2+: Tasks whose dependencies are all satisfied by prior waves
   - Final wave: Validation tasks that depend on everything else

2. **Identify contracts** -- at each wave boundary (milestone), determine what the completing wave produces that the next wave needs

3. **Identify parallel opportunities** within each wave:
   - Tasks with no mutual dependencies run simultaneously
   - Tasks marked `Parallel: true` with all deps satisfied run simultaneously
   - NEVER parallelize tasks that modify the same files

### Step 3: Team formation
Create the agent team based on Steps.md Team Members section:

- **Explicit team size** -- state the exact number of teammates
- **Named teammates** -- use names from Steps.md (e.g., "builder-api", "builder-ui")
- **Single responsibility** -- each teammate gets ONE clear focus area
- **File ownership boundaries** -- assign exclusive ownership of specific files/directories
- **Full context per teammate** -- every teammate receives the complete plan, their tasks, upstream contracts, and file ownership boundaries

### Step 4: Contract-first execution with event log + Monitor

Before spawning any teammates, initialise the event log and `.cortex/prompts/`:

```bash
mkdir -p .cortex .cortex/prompts && : > .cortex/events.log
```

**Wave 1 (Foundation):**
1. Render each upstream teammate's prompt file to `.cortex/prompts/<S-id>.md` using the template below.
2. Spawn upstream teammates in the background in a single message:
   ```ts
   Task({
     description: "S001: Set up shared types",
     prompt: "<contents of .cortex/prompts/S001.md>",
     subagent_type: "general-purpose",
     run_in_background: true,
   });
   ```
3. Start the Monitor on `.cortex/events.log` so the team lead sees `task_done`, `contract_ready`, `milestone_reached`, and `error` events:
   ```ts
   Monitor({
     description: "cortex events: task_done, contract_ready, milestone_reached, error",
     command: `tail -n 0 -F .cortex/events.log | grep --line-buffered -E '"type":"task_done"|"type":"contract_ready"|"type":"milestone_reached"|"type":"error"'`,
     timeout_ms: 3600000,
     persistent: false,
   });
   ```
4. **Wait for their contracts.** Do not proceed until:
   - The expected `task_done` events for the foundation wave have arrived
   - The expected `contract_ready` events for the foundation wave have arrived
   - Contract files exist on disk and contain concrete content
   - Milestone drift check passes (see step 5)

**Wave 2+ (Parallel Execution):**
1. Read contract files listed in the completed milestone, inject actual content into each downstream teammate's prompt file at `.cortex/prompts/<S-id>.md`.
2. Spawn downstream teammates in the background (same shape as Wave 1).
3. Teammates message each other directly via `SendMessage` when:
   - They change an interface another teammate depends on
   - They are blocked and need input from another teammate
   - They discover a contract mismatch or integration issue
4. The team lead continues to react to event log events, not individual `TaskOutput` calls.

**Final Wave (Validation):**
1. After all implementation teammates complete, spawn quality-engineer (still in the background, still reporting via the event log).
2. Quality engineer validates against Spec.md testable assertions.
3. Quality engineer runs all Validation Commands from Steps.md.
4. Reports PASS or FAIL per acceptance criterion.
5. If FAIL: identify which teammate's work needs correction via the `error`/`note` fields; resume that teammate with the specific correction.

### Step 5: Milestone checkpoints with Advisor consult
At each milestone boundary, the team lead:
1. Runs stub detection on changed files
2. Verifies all `S###-T`/`S###-D` tasks are complete for this milestone
3. Extracts contracts from declared file paths and stores them for the next wave's prompts
4. Runs the drift checkpoint, consulting the Advisor tool first:

   ```bash
   cat > /tmp/cortex-drift-<milestone>.md <<'EOF'
   Milestone: [milestone name]

   Spec.md testable assertions referenced by this milestone:
   [assertion IDs and text]

   Files produced by the completing wave:
   [list of changed files with short excerpts]

   Question: for each assertion, is the implementation (a) aligned,
   (b) diverged and needs an ADR, or (c) diverged because the spec was wrong?
   Respond as enumerated bullets, one per assertion.
   EOF

   bun run .claude/hooks/advisor/advisor-cli.ts --question-file /tmp/cortex-drift-<milestone>.md
   ```

   - Exit 0: present the Advisor's verdict alongside each assertion and ask the user to confirm.
   - Exit 2: Advisor unavailable; fall back to in-thread reasoning -- the team lead reasons in-thread on Sonnet and asks the user directly.

5. Updates Steps.md Progress section

### Step 6: Monitoring
While the team works:
- React to event log notifications (`task_done`, `contract_ready`, `milestone_reached`, `error`).
- Only pull a teammate's full `TaskOutput` when an `error` event arrives or a `task_done` event is missing past its deadline.
- If a teammate is blocked, intervene via `SendMessage` with guidance
- If contract mismatches are discovered, mediate and clarify
- Log all coordination to `.cortex/session.md`

### Step 7: Shutdown
1. Verify all tasks in shared task list show as complete (matching the wave plan)
2. Run all Validation Commands and capture results
3. Stop the Monitor via `TaskStop` (or let it time out)
4. Shut down all teammates and clean up team
5. Update Steps.md Progress: Status = "Complete"
6. Archive `.cortex/session.md` to `.cortex/archive/`
7. Present completion report

## Teammate Prompt Template

```
You are [NAME], the [ROLE] on this team.

PLAN CONTEXT:
[Paste relevant Spec.md and Tech.md sections]

YOUR TASKS:
[List specific tasks from Steps.md assigned to this teammate]

FILES YOU OWN (only modify these):
[Explicit list of files/directories]

UPSTREAM CONTRACTS (your inputs):
[Paste actual schemas, interfaces, API specs from upstream agents]
[If Wave 1: "None -- you are producing the foundation"]

CONTRACTS YOU MUST PRODUCE (your outputs):
[What downstream teammates need from you]
[If final wave: "None -- you are consuming, not producing"]

COORDINATION (event log):
- When you finish a task, run:
    bun run .claude/hooks/event-log/event-log.ts append --source [NAME] --type task_done --task <S-id>
- When you write a contract file listed in the milestone Contracts, run:
    bun run .claude/hooks/event-log/event-log.ts append --source [NAME] --type contract_ready --contract <file-path>
- If you hit a blocker you cannot resolve, run:
    bun run .claude/hooks/event-log/event-log.ts append --source [NAME] --type error --note "<short reason>"
- Message the team lead via the event log's `error` channel or via `SendMessage` only when you need help.
- Message [OTHER_TEAMMATE] directly via `SendMessage` if you change [SPECIFIC_INTERFACE]
- Mark your task complete in the shared task list when done
- Do NOT emit events for routine tool calls. The event log is for milestones only.
```

## Fallback
If Agent Teams is unavailable or fails to initialize, fall back to `/impl` (sub-agent execution). Inform the user: "Agent Teams unavailable. Falling back to /impl with sub-agent execution."

## Orchestration Tools Reference

### Task list setup

```typescript
TaskCreate({
  subject: "S001: Set up database schema",
  description: "Create migration files for user and session tables. See Steps.md S001.",
  activeForm: "Setting up database schema",
});

TaskUpdate({ taskId: "2", addBlockedBy: ["1"] });
TaskUpdate({ taskId: "1", owner: "builder-api" });

TaskList({});
TaskGet({ taskId: "1" });
```

### Spawning teammates in the background

Teammates run on Sonnet. They execute against a detailed prompt file (spec/tech excerpts, file ownership, upstream contracts, a concrete task list) -- that's execution work, not design work. The design decisions already happened upstream in `/blueprint`, and the milestone drift check (which consults the Advisor tool for an Opus verdict) plus the final quality-engineer validation run catch any misalignment. Set `model: "sonnet"` explicitly so future readers don't have to trace team-lead inheritance.

```typescript
Task({
  description: "S001: Set up shared types",
  prompt: "<contents of .cortex/prompts/S001.md>",
  subagent_type: "general-purpose",
  model: "sonnet",
  run_in_background: true,
});

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

### Monitoring via the event log

```typescript
Monitor({
  description: "cortex events: task_done, contract_ready, milestone_reached, error",
  command: `tail -n 0 -F .cortex/events.log | grep --line-buffered -E '"type":"task_done"|"type":"contract_ready"|"type":"milestone_reached"|"type":"error"'`,
  timeout_ms: 3600000,
  persistent: false,
});

// Only on error events -- never on the happy path:
TaskOutput({ task_id: "agentId", block: false, timeout: 5000 });

// Mark task complete after a task_done event arrives:
TaskUpdate({ taskId: "1", status: "completed" });
```

### Consulting the Advisor at milestones

```bash
cat > /tmp/cortex-drift-m1.md <<'EOF'
[assertions + changed files + question]
EOF

bun run .claude/hooks/advisor/advisor-cli.ts --question-file /tmp/cortex-drift-m1.md
# Exit 0 -> stdout has enumerated verdict
# Exit 2 -> fall back to in-thread reasoning
```

### Resuming teammates

When a teammate needs corrections after a milestone check, resume to preserve their context:

```typescript
Task({
  description: "S002: Fix API contract mismatch",
  prompt: "The milestone check found the response shape differs from...",
  subagent_type: "general-purpose",
  resume: "abc123",
});
```

When to resume vs start fresh:
- **Resume**: Corrections, follow-up work, or the teammate needs prior context
- **Fresh**: Unrelated task or clean slate preferred

## Rules
- You are the team lead. You orchestrate, you do not implement.
- Never bypass the team to "just do it faster"
- Never spawn teammates without clear contracts from upstream
- Never let teammates work on overlapping files
- Never pull `TaskOutput` on the happy path -- events are authoritative
- Set `model: "sonnet"` explicitly on spawned teammate `Task()` calls. Teammates execute a well-specified plan; Opus-rate reasoning is reserved for the Advisor tool at milestone boundaries.
- Milestone drift checks are mandatory, not optional
- Advisor-cli exit code 2 means fall back to in-thread reasoning -- never fail the wave on advisor unavailability
