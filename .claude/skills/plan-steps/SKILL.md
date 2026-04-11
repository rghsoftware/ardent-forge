# Skill: Generate Implementation Steps

## Purpose
Break a feature into numbered, ordered implementation tasks with paired test and documentation tasks, team member assignments, dependency declarations, and contract specifications at milestone boundaries. This is Phase 3 of the 4-phase planning workflow. Produces Steps.md.

## When to use
- After Tech.md is approved (Phase 2 complete)
- User says "break this down", "create tasks", "plan the steps"

## Prerequisites
- `Context/Features/NNN-FeatureName/Spec.md` exists (approved)
- `Context/Features/NNN-FeatureName/Tech.md` exists (approved)

## Workflow

### Step 1: Load context
1. Read the feature's `Spec.md` -- Requirements and Testable Assertions
2. Read the feature's `Tech.md` -- Architecture decisions, stack details, testing strategy
3. Read active `.claude/rules/` for stacks this feature touches
4. Read accepted ADRs referenced in Tech.md
5. Scan `core/agents/` to identify available specialist agents

### Step 2: Determine team composition
Based on the stacks and domains this feature touches, select team members:

| Domain | Agent | Use for |
|---|---|---|
| Python/FastAPI backend | backend-engineer | API endpoints, business logic |
| Vue/TypeScript frontend | frontend-specialist | UI components, state management |
| Rust/Tauri desktop | backend-engineer or general-purpose | Native code, IPC handlers |
| Database/Supabase | supabase-specialist | Schema, migrations, RLS |
| Security-sensitive work | security-auditor | Auth, access control, secrets |
| Performance-critical work | performance-optimizer | Optimization, benchmarking |
| Documentation/content | content-writer | Docs, guides, API references |
| Cross-domain/general | general-purpose | Tasks spanning multiple domains |
| Validation (always last) | quality-engineer | Read-only inspection of completed work |

Define each team member with:
- **Name**: Unique identifier (e.g., `builder-api`, `builder-ui`, `validator`)
- **Role**: Single responsibility description
- **Agent Type**: From the available agents list
- **Resume**: `true` (continue with context) or `false` (fresh start each task)

### Step 3: Generate implementation tasks
1. Break the feature into sequential implementation tasks (S001-S999)
2. Group tasks into logical phases with milestone markers
3. For each task, assign:
   - **Assigned**: Which team member handles this task
   - **Depends**: Task IDs this depends on, or `none`
   - **Parallel**: `true` if can run alongside adjacent tasks with satisfied deps
4. Generate paired test tasks (S###-T) and documentation tasks (S###-D)
5. At each milestone boundary, declare contracts (file paths + descriptions)

### Step 4: Write Steps.md
Write `Context/Features/NNN-FeatureName/Steps.md` using the template and rules below.

### Step 5: Review with user
1. Present the task breakdown with team assignments
2. Confirm milestone placement and contract declarations make sense
3. User may adjust agent assignments, add/remove tasks, modify dependencies
4. Iterate until approved

## Task Numbering

- **S001-S999**: Implementation tasks
- **S###-T**: Test task paired to S### (placed immediately after S###)
- **S###-D**: Documentation task (placed at milestone boundaries)

## Test Task Generation Rules (S###-T)

**Always generate for:**
- New API endpoints, routes, or IPC command handlers
- New business logic, algorithms, or data transformations
- New data models, schemas, or migrations
- State management changes (stores, caches, session handling)
- Interrupt handlers, peripheral drivers, hardware abstraction layers
- Anything that modifies persistent state

**Skip for:**
- Configuration file changes
- Import reorganization or module restructuring
- Renaming without behavior change
- CSS/styling-only changes
- Dependency version bumps
- Documentation-only changes

**Test task content:**
- Include 3-5 specific test scenarios in parentheses
- Derive scenarios from Spec.md Testable Assertions where they map to this task
- Include edge cases and error conditions relevant to the stack

**Stack test conventions:**

| Stack | Framework | Convention |
|---|---|---|
| Python/FastAPI | pytest + httpx AsyncClient | Async tests, fixture-based setup, parametrized edge cases |
| Vue.js/TypeScript | Vitest + Vue Test Utils | Component mount tests, Pinia store tests, composable unit tests |
| Rust/Tauri | cargo test + Tauri mock runtime | #[test] in module, integration tests in tests/ dir |
| Embedded C/C++ | Unity test framework | HAL-abstracted tests, mock peripherals, ISR-safe assertions |
| C++/Qt | Qt Test (QTest) | QCOMPARE/QVERIFY assertions, QSignalSpy for signals |
| Kotlin/KMP | kotlin.test + JUnit5 | commonTest for shared logic, platform tests for expect/actual |
| React/Next.js | Vitest + React Testing Library | Component render tests, hook tests, integration tests |

## Documentation Task Generation Rules (S###-D)

**Generate when a task:**
- Adds or changes a public API endpoint
- Adds a new user-facing feature or capability
- Changes configuration, environment variables, or setup requirements
- Introduces a new architectural pattern
- Changes build or deployment process
- Adds a dependency with non-obvious setup steps

**Skip when a task:**
- Is internal refactoring with no API or behavior change
- Fixes a bug without changing expected behavior
- Is a test-only change
- Modifies already-documented behavior (unless docs become incorrect)

**Doc task content:**
- Specify which document to update (README.md, API.md, CLAUDE.md, etc.)
- Describe what section or content needs updating
- Place at milestone boundaries, not after every implementation task

## Milestone Placement Rules

Place a milestone marker:
- After completing a logical unit of work (e.g., "data layer done", "API complete")
- When integration between components should be verified
- Before switching stacks or domains
- At natural review points where drift checking is valuable
- At wave boundaries where contracts need to pass between agents

Each milestone marker includes:
- A short description of what was completed
- References to Spec.md Testable Assertions to verify at this checkpoint
- Contract declarations listing files downstream agents will need

## Contract Declaration Rules

Contracts are file paths declared at milestone boundaries that the orchestrator will extract and inject into downstream agent prompts at execution time.

**Declare a contract when:**
- A wave produces types, schemas, or interfaces that the next wave consumes
- Database migrations create tables that API code will reference
- API endpoints produce response shapes that frontend code will consume
- Shared configuration or constants are created that multiple agents need

**Contract format in Steps.md:**
`**Contracts:**`
`- path/to/file.ts -- Short description of what it contains`

The orchestrator reads the actual file content at execution time and pastes it into downstream agent prompts. If a declared contract file does not exist after a wave completes, the orchestrator flags it as a milestone failure.

## Steps.md Template

```markdown
# Implementation Steps: [Feature Name]

**Spec:** Context/Features/NNN-FeatureName/Spec.md
**Tech:** Context/Features/NNN-FeatureName/Tech.md

## Progress
- **Status:** Not started
- **Current task:** --
- **Last milestone:** --

## Team Orchestration

### Team Members
- **[unique-name]**
  - Role: [single responsibility]
  - Agent Type: [agent from core/agents/]
  - Resume: [true|false]
- **validator**
  - Role: Quality validation (read-only)
  - Agent Type: quality-engineer
  - Resume: false

## Tasks

### Phase 1: [Phase description]
- [ ] S001: [Implementation task description]
  - **Assigned:** [team-member-name]
  - **Depends:** none
  - **Parallel:** false
- [ ] S001-T: Test [what to test] ([scenario 1, scenario 2, scenario 3])
  - **Assigned:** [team-member-name]
  - **Depends:** S001
- [ ] S002: [Implementation task description]
  - **Assigned:** [team-member-name]
  - **Depends:** none
  - **Parallel:** true

🏁 MILESTONE: Phase 1 complete -- verify against [A-001, A-002]
  **Contracts:**
  - `path/to/types.ts` -- Type definitions for downstream consumers

### Phase 2: [Phase description]
- [ ] S003: [Implementation task description]
  - **Assigned:** [team-member-name]
  - **Depends:** S001
  - **Parallel:** true
- [ ] S003-T: Test [what to test] ([scenarios])
  - **Assigned:** [team-member-name]
  - **Depends:** S003
- [ ] S004: [Implementation task description]
  - **Assigned:** [team-member-name]
  - **Depends:** S001
  - **Parallel:** true
- [ ] S004-D: Update [document] -- [what to add/change]
  - **Assigned:** [team-member-name]
  - **Depends:** S004

🏁 MILESTONE: Phase 2 complete -- verify against [A-003, A-004]

### Phase 3: Integration & Validation
- [ ] S005: Integration and wiring
  - **Assigned:** [team-member-name]
  - **Depends:** S003, S004
  - **Parallel:** false
- [ ] S005-T: E2E integration tests
  - **Assigned:** validator
  - **Depends:** S005

🏁 MILESTONE: Feature complete -- verify all assertions, full drift check

## Acceptance Criteria
- [ ] All testable assertions from Spec.md verified
- [ ] All tests passing
- [ ] No TODO/FIXME stubs remaining
- [ ] Documentation updated

## Validation Commands
- [specific commands to verify the work]
```

## Rules
- Tasks must be small enough to complete in one Claude Code session
- Each task must be independently testable or verifiable
- Test tasks follow their implementation task, never batched at the end
- The final milestone always includes "verify all assertions, full drift check"
- Mark Progress section as "Not started" -- impl-start skill updates this
- If a task depends on an unresolved Open Question from Spec.md, note it
- Every task must have Assigned, Depends, and Parallel fields
- Team must always include a quality-engineer validator as the final step
- Contract declarations reference file paths that will exist after the wave completes
- Parallel tasks within a wave must not modify the same files
- Wave boundaries align with milestones -- the orchestrator uses milestones to determine execution waves
