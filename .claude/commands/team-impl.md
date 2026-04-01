---
description: Execute Steps.md via Agent Teams with peer-to-peer coordination
model: opus
---

# Team Implementation (Agent Teams)

Execute a planned feature using Claude Code's Agent Teams for peer-to-peer coordination. Unlike `/impl` (hub-and-spoke sub-agents), `/team-impl` spawns a coordinated team where agents communicate directly, share a task list, and collaborate in real-time.

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
1. Identify feature from ``
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

### Step 4: Contract-first execution

**Wave 1 (Foundation):**
1. Spawn upstream teammates with no dependencies
2. They work on foundational tasks: schemas, shared types, interfaces
3. **Wait for their contracts.** Do not proceed until:
   - Upstream teammates mark foundation tasks complete
   - Contract files exist and contain concrete content
   - Milestone drift check passes against Spec.md assertions

**Wave 2+ (Parallel Execution):**
1. Read contract files, inject actual content into each downstream teammate's prompt
2. Downstream teammates work in parallel on their assigned tasks
3. Teammates message each other directly when:
   - They change an interface another teammate depends on
   - They are blocked and need input from another teammate
   - They discover a contract mismatch or integration issue

**Final Wave (Validation):**
1. After all implementation teammates complete, spawn quality-engineer
2. Quality engineer validates against Spec.md testable assertions
3. Quality engineer runs all Validation Commands from Steps.md
4. Reports PASS or FAIL per acceptance criterion
5. If FAIL: identify which teammate's work needs correction

### Step 5: Milestone checkpoints (same as /impl)
At each milestone boundary, the team lead:
1. Runs stub detection
2. Verifies all test/doc tasks are complete
3. Extracts contracts from declared file paths
4. Runs drift check against Spec.md testable assertions
5. Updates Steps.md Progress section

### Step 6: Monitoring
While the team works:
- Watch shared task list for stalled or stuck tasks
- If a teammate is blocked, intervene with guidance
- If contract mismatches are discovered, mediate and clarify
- Log all coordination to `.cortex/session.md`

### Step 7: Shutdown
1. Verify all tasks in shared task list show as complete
2. Run all Validation Commands and capture results
3. Shut down all teammates and clean up team
4. Update Steps.md Progress: Status = "Complete"
5. Archive `.cortex/session.md` to `.cortex/archive/`
6. Present completion report

## Teammate Prompt Template

`
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

COORDINATION:
- Message the lead when your contract is ready
- Message [OTHER_TEAMMATE] directly if you change [SPECIFIC_INTERFACE]
- Mark your task complete in the shared task list when done
`

## Fallback
If Agent Teams is unavailable or fails to initialize, fall back to `/impl` (sub-agent execution). Inform the user: "Agent Teams unavailable. Falling back to /impl with sub-agent execution."

## Rules
- You are the team lead. You orchestrate, you do not implement.
- Never bypass the team to "just do it faster"
- Never spawn teammates without clear contracts from upstream
- Never let teammates work on overlapping files
- Milestone drift checks are mandatory, not optional
