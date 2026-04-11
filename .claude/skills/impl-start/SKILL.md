# Skill: Start Implementation

## Purpose
Begin or resume implementation of a planned feature. Restores full context from planning artifacts, initializes execution session, and delegates tasks to specialist agents in waves defined by milestone boundaries. This is Phase 4 of the 4-phase planning workflow.

## When to use
- Starting implementation after planning is complete
- Resuming work in a new Claude Code session
- User says "start working", "implement this", "continue where we left off"

## Prerequisites
- Feature has at minimum a Spec.md (full plan) or a quick plan file
- For full features: Spec.md, Tech.md, and Steps.md all exist

## Workflow

### Step 1: Restore context
1. Read `CLAUDE.md` for project architecture
2. Identify which feature to work on:
   - If user specifies, use that feature
   - If resuming, check `.cortex/session.md` for active session
   - If ambiguous, ask the user
3. Read the feature's planning artifacts:
   - `Spec.md` -- requirements and testable assertions
   - `Tech.md` -- architecture decisions and stack details
   - `Steps.md` -- task list, team, milestones, contracts
4. Read all accepted ADRs in `Context/Decisions/` relevant to this feature
5. Read active `.claude/rules/` for stacks this feature touches

### Step 2: Determine execution state
1. Parse Steps.md Progress section (Status, Current task, Last milestone)
2. Check if `.cortex/session.md` exists (resuming an active session)
3. Find the first unchecked task in Steps.md
4. Determine which wave/milestone we are in

### Step 3: Initialize or resume execution session
**If starting fresh:**
1. Create `.cortex/session.md` with plan reference and team roster
2. Create TaskCreate entries for each S### task
3. Set dependencies via addBlockedBy based on Depends fields
4. Assign owners based on Assigned fields
5. Update Steps.md Progress: Status = "In progress"

**If resuming:**
1. Read `.cortex/session.md` for agent state and completed contracts
2. Sync TaskList with Steps.md checkboxes
3. Identify where execution left off (which wave, which tasks remain)

### Step 4: Present current state and confirm
1. Display current task or wave status
2. Show team composition and assignments
3. Show last milestone completed (if any)
4. Ask: "Proceed with implementation?"

### Step 5: Execute via agent delegation
Delegate to the `/impl` command workflow, which uses the background + Monitor + event-log pattern (see `core/skills/monitor-loop/SKILL.md`):
- Render each task's specialist prompt to `.cortex/prompts/<S-id>.md`
- Spawn agents for the current wave with `Task({run_in_background: true})`, one call per parallel task in a single orchestrator message
- Start a `Monitor` on `.cortex/events.log` filtered to `task_done`, `contract_ready`, `milestone_reached`, and `error`
- React to events instead of blocking on `TaskOutput`. Only pull an agent's output when an `error` event fires or an expected `task_done` is missing past its deadline
- Pass upstream contracts from previous milestones by injecting them into the next wave's prompt files
- Run milestone checkpoints (stub detection, drift check via the Advisor tool, contract extraction)
- Continue through waves until complete

For quick plans (single-file plan, no team orchestration):
- Execute tasks directly without agent delegation
- Still run milestone checkpoints if milestones exist
- Mark tasks complete as they are done

### Step 6: Handle completion
- If all tasks complete: update Status to "Complete", suggest `/qa` and `/review-capture`
- If context window filling: save progress to Steps.md and `.cortex/session.md`, tell user to start a new session
- If plan is wrong: pause, discuss with user, create ADR or update Spec.md

## Rules
- Never skip a task unless the user explicitly approves
- Never skip milestone checkpoints -- they are not optional
- If a task reveals the plan is wrong, pause and discuss rather than improvising
- Test tasks (S###-T) must produce actual test files, not just comments
- Doc tasks (S###-D) must modify the specified document
- If an ADR is needed at a milestone, use the adr-create skill before continuing
- Save progress to Steps.md and `.cortex/session.md` frequently
