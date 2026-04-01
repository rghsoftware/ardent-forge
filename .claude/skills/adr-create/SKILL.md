# Skill: Create Architecture Decision Record

## Purpose
Create a new ADR in `Context/Decisions/` with mandatory contradiction detection against existing ADRs. Ensures every architectural decision is recorded with explicit compatibility analysis.

## When to use
- Implementation deviates from the spec
- A significant technical decision is made that affects future work
- User says "create an ADR", "document this decision", "we're changing the approach"
- Detected at a milestone checkpoint during impl-start

## Workflow

### Step 1: Load all existing ADRs
1. Glob `Context/Decisions/*.md`
2. For each ADR, extract:
   - **Number and title**
   - **Status** (Proposed, Accepted, Superseded)
   - **Decision summary** (the core decision in 1-2 sentences)
   - **Files affected**
   - **Feature area** (which feature or system area)
   - **Supersedes/superseded-by relationships**
3. Skip ADRs with status "Superseded" for conflict checking (they're inactive)

### Step 2: Determine next ADR number
1. Find the highest NNNN in existing ADR filenames
2. Assign NNNN+1

### Step 3: Draft the ADR
1. Capture the decision from the user or from the milestone context
2. Identify files affected and feature area
3. Fill all template sections

### Step 4: Contradiction detection
This is the critical step. Compare the new ADR against all accepted (non-superseded) ADRs:

**Check for overlapping scope:**
- Same files affected
- Same feature area
- Same architectural concern (e.g., "database access pattern", "IPC protocol", "error handling strategy", "auth mechanism", "state management approach")

**Stack-specific overlap definitions:**
- **Python:** Same module/package, same API endpoint group, same database model, same middleware chain
- **Vue.js:** Same component tree, same Pinia store module, same route group, same composable
- **Rust:** Same crate, same Tauri command namespace, same state manager, same trait implementation
- **Embedded C:** Same peripheral, same FreeRTOS task, same interrupt vector, same communication bus
- **C++/Qt:** Same QObject class hierarchy, same QML module, same signal/slot interface, same CMake target, same thread ownership boundary
- **Kotlin:** Same KMP module, same expect/actual pair, same DI scope, same Compose navigation graph

**If overlapping ADRs found:**
1. Present each overlapping ADR with its decision summary
2. Require the user to resolve each overlap with one of:
   - **"Compatible because [reason]"** — no conflict, decisions coexist
   - **"Supersedes ADR-XXXX"** — new ADR replaces the old one
   - **"Need to rethink"** — back out and reconsider the decision
3. Record the resolution in the Compatibility section of the new ADR

**If no overlapping ADRs found:**
- Write "No overlapping accepted ADRs found" in the Compatibility section

### Step 5: Write the ADR file
1. Create `Context/Decisions/NNNN-decision-title.md` (kebab-case filename)
2. Fill all sections including the completed Compatibility section

### Step 6: Update related artifacts
1. If this ADR documents a spec deviation, update the feature's `Spec.md`:
   - Add entry to Revision History table
   - Update affected Testable Assertions status to "Superseded by ADR-NNNN"
2. Note the ADR number for inclusion in the next commit message

## ADR Template

```markdown
# ADR-NNNN: [Decision Title]

## Status
[Proposed | Accepted | Superseded by ADR-XXXX]

## Context
[Problem or situation that motivated this decision]
[If deviation from spec: "Deviates from Context/Features/NNN-Name/Spec.md Section X"]

## Decision
[What was decided, with enough detail to understand the choice without reading other documents]

## Consequences

**Benefits:**
- [What becomes easier or better]

**Trade-offs:**
- [What becomes harder or worse]

**Risks:**
- [What could go wrong, and under what conditions]

## Compatibility

**Checked against:** [list of ADR numbers that touch the same area]
[For each overlapping ADR:]
- ADR-XXXX ([title]): Compatible because [reason]
  OR
- ADR-XXXX ([title]): Superseded by this ADR because [reason]

[If no overlaps:]
No overlapping accepted ADRs found.

## Related
- **Feature:** Context/Features/NNN-Name/
- **Files affected:** [paths]
- **Spec section:** [if this documents a deviation]
```

## Rules
- The Compatibility section is NOT optional — every ADR must address overlapping decisions
- Never modify an existing ADR's content — create a new one that supersedes it
- Status of superseded ADRs should be updated to "Superseded by ADR-XXXX" (this is the ONE exception to the no-modify rule — status field only)
- ADR filenames use kebab-case: `0003-switch-to-graphql.md`
- If the user cannot resolve a contradiction, the ADR should not be created — the decision needs more thought
