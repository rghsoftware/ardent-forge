---
description: Execute Steps.md via hub-and-spoke sub-agent orchestration
model: opus
---

# Implementation Orchestrator

Execute a planned feature by reading Steps.md and delegating tasks to specialist agents in waves defined by milestone boundaries.

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
1. Read `Context/Features/NNN-FeatureName/Steps.md` -- tasks, team, milestones
2. Read `Context/Features/NNN-FeatureName/Spec.md` -- requirements and assertions
3. Read `Context/Features/NNN-FeatureName/Tech.md` -- architecture decisions
4. Read `CLAUDE.md` for project conventions
5. Parse Steps.md to extract:
   - Team Members (names, agent types, resume behavior)
   - Task list with assignments, dependencies, parallel flags
   - Milestones with testable assertion references and contract declarations

### Step 3: Initialize execution session
1. Create `.cortex/session.md` with plan reference and team roster
2. Create TaskCreate entries for each S### task in Steps.md
3. Set dependencies via addBlockedBy based on Depends fields
4. Assign owners based on Assigned fields
5. Update Steps.md Progress: Status = "In progress"

### Step 4: Build wave execution plan
Parse milestones to determine execution waves:
- **Wave 1**: All tasks before the first milestone
- **Wave 2**: All tasks between milestone 1 and milestone 2
- **Wave N**: Tasks between milestone N-1 and N
- Within each wave, group tasks by Parallel flag and dependency satisfaction

### Step 5: Execute waves

For each wave:

**5a. Spawn agents for the wave**
- Deploy specialist agents via Task tool for each task in the wave
- For tasks marked `Parallel: true` with all deps satisfied: spawn simultaneously
- For sequential tasks: spawn one at a time, wait for completion
- Each agent receives:
  - The full Spec.md and Tech.md context
  - Their specific task description from Steps.md
  - Upstream contracts (actual file content from previous wave)
  - File ownership boundaries
  - Instructions to use TaskUpdate to mark tasks complete

**5b. Monitor and coordinate**
- Track task completion via TaskList/TaskUpdate
- Log agent activity to `.cortex/session.md`
- If an agent is blocked, provide guidance or reassign

**5c. Milestone checkpoint**
When all tasks before a milestone are complete:

1. **Stub detection** -- search completed files for:
   - `// TODO:` or `# TODO:` without `tracked in Steps.md S###`
   - `// FIXME:` or `# FIXME:`
   - `pass` as sole function body (Python)
   - `todo!()` or `unimplemented!()` (Rust)
   - `throw NotImplementedError` or `throw new Error("not implemented")`
   - Empty method/function bodies

2. **Verify test/doc tasks** -- check that all S###-T and S###-D tasks before this milestone are completed

3. **Contract extraction** -- for each file path listed under the milestone's Contracts:
   - Read the file content
   - If file does not exist, flag as milestone failure and stop
   - Store the content for injection into next wave's agent prompts
   - Log the delivery to `.cortex/session.md`

4. **Drift checkpoint** -- pull the Testable Assertions referenced in the milestone from Spec.md:
   - Present each assertion with its ID
   - Ask: "Does the current implementation align? Options:"
     - **Aligned** -- proceed to next wave
     - **Diverged, need ADR** -- pause, create ADR documenting the deviation
     - **Diverged, spec was wrong** -- update Spec.md with revision history entry

5. Update Steps.md Progress section with last completed milestone

6. **Continue to next wave** with extracted contracts injected into agent prompts

### Step 6: Final validation
After all waves complete:
1. Dispatch quality-engineer in validation mode
2. Run all Validation Commands from Steps.md
3. Verify all Acceptance Criteria
4. Report PASS/FAIL per criterion

### Step 7: Complete
1. Update Steps.md Progress: Status = "Complete"
2. Run Validation Commands and capture results
3. Archive `.cortex/session.md` to `.cortex/archive/`
4. Present completion report
5. Suggest next steps:
   - Run `/qa` for parallel stack-specific quality checks
   - Run `/review` to capture findings
   - Run `/commit` when ready

## Agent Prompt Template

When spawning each agent, provide this context:

`
You are [NAME], the [ROLE] on this team.

FEATURE CONTEXT:
[Paste relevant Spec.md sections -- requirements and testable assertions]
[Paste relevant Tech.md sections -- architecture decisions for this domain]

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

COORDINATION:
- Mark your tasks complete via TaskUpdate when done
- If you change an interface another agent depends on, note it clearly
- Read all relevant files and load skills before starting work

Think hard and provide thorough implementation.
`

## Rules
- Never skip milestone checkpoints -- they are not optional
- If a task reveals the plan is wrong, pause and discuss with the user
- If context window is filling up, save progress to Steps.md and `.cortex/session.md`
- Parallel agents must not modify the same files
- Contract files must exist before downstream agents are spawned
- The quality-engineer always runs last in validation mode (read-only)
