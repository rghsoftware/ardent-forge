# Skill: Resolve Review Findings

## Purpose
Work through a captured review file, executing each finding's category as its action.
Findings were already triaged during capture -- resolve just executes.

## When to use
- At the start of a fresh session after a review was captured
- User says "resolve review", "fix review findings", "work through the review"
- User references a specific review file in Context/Reviews/

## Prerequisites
- A review file must exist in `Context/Reviews/` (created by review-capture)
- This should run in a **fresh session** with full context budget -- not in the same
  session that performed the review

## Workflow

### Step 1: Load the review file
1. If the user specified a file, load that one
2. Otherwise, list files in `Context/Reviews/` and find the most recent with
   `Status: Unresolved`
3. If no unresolved reviews exist, tell the user -- nothing to do
4. Read the full review file
5. Load the associated feature's Spec.md, Steps.md, and Tech.md for context
6. Parse all findings into a working list, noting each finding's category, severity,
   file reference, and description

### Step 2: Present findings and confirm
List every finding with its ID, severity, and title, grouped by category.
The category from capture determines the action -- no re-triage needed.

```
Findings

  [FIX] -- 9 findings

  - P10-001 (Critical) findActivityId returns fabricated ID causing silent override corruption
  - P10-002 (High) Stale closure in handleEditRemove Undo loses edits
  - P10-003 (High) Guard clauses in builder.tsx lack user-facing error state (x3)
  - P10-004 (High) Template fetch error not handled in SessionEditSheet
  - P10-005 (Medium) applyOverrides silently drops setScheme overrides without resolutionCtx
  - P10-006 (Low) Orphaned section header in session-detail.tsx
  - P10-007 (Low) JSDoc inaccuracy in applyOverrides -- "Returns a new array"
  - P10-008 (Low) File path comment is noise
  - P10-009 (Low) SQLite migration lacks comment unlike Supabase counterpart

  [TASK] -- 3 findings

  - P10-010 (High) Data-mapper tests only cover overrides: null
  - P10-011 (Medium) Rust backend validates JSON syntax but not SessionOverrides structure
  - P10-012 (Low) Missing test for setScheme override without resolutionCtx

  [ADR] -- 2 findings

  - P10-013 (Medium) Triple/quadruple null representation for "no overrides"
  - P10-014 (Medium) Orphaned override keys silently skipped with no logging

  [RULE] -- 1 finding

  - P10-015 (Medium) useQuery error state destructuring convention

  Total: 15 findings

  Proceed? (yes / or flag specific findings to skip or recategorize)
```

**CRITICAL:** Always list findings by title, not just counts. The user needs to
see what they are about to resolve.

If the user says "yes" or "proceed", move to Step 3. If they flag specific
findings (e.g., "skip P10-008, recategorize P10-005 as TASK"), apply those
changes first, then proceed.

### Step 3: Execution phase
Execute each finding's action based on its category.
Process in this order: Fix, Task, ADR, Rule.

#### Fix
1. Open the referenced file and line
2. Apply the fix
3. Verify the fix does not break anything obvious (check imports, references)
4. If the fix turns out to be more complex than expected (requires restructuring,
   affects other modules, changes behavior), inform the user and ask whether to
   reclassify as Task or ADR
5. Update the finding in the review file:
   - **Status:** Fixed
   - **Resolution:** {Brief description of what was changed}

#### Task
1. Determine the next available S### number from Steps.md
2. Add the new task to Steps.md in the appropriate phase:
   - Test tasks: add as S###-T after the related implementation task
   - Documentation tasks: add as S###-D after the related implementation task
   - New implementation: add at the end of the relevant phase
3. If the finding relates to a Testable Assertion, verify the assertion exists in
   Spec.md. If not, add it to the Testable Assertions table.
4. Update the finding in the review file:
   - **Status:** Task created
   - **Resolution:** Added as S### in Steps.md

#### ADR
1. Use the adr-create skill to create the ADR
2. Update the finding in the review file:
   - **Status:** ADR created
   - **Resolution:** ADR-NNNN

#### Rule
1. Identify which rule file should be updated (or if a new rule file is needed)
2. Read the current rule file
3. Add the convention to the appropriate rule file
4. If the gap is something the post-edit hook could catch, update the hook too
5. Update the finding in the review file:
   - **Status:** Rule updated
   - **Resolution:** Added to {rule-file}

### Step 4: Update review file header
After executing all actions, update the review file:

1. Count resolutions:
   - All resolved (no Deferred) -- **Status:** Resolved
   - Some deferred -- **Status:** Partially resolved
   - Any unresolved -- **Status:** Unresolved (should not happen if workflow completes)
2. Update the Resolution Checklist at the bottom (check completed items)
3. Add a Resolution Summary section:

```markdown
## Resolution Summary
**Resolved at:** {YYYY-MM-DD}
**Session:** {brief description}

| Category | Total | Resolved |
|---|---|---|
| [FIX] | N | N |
| [TASK] | N | N |
| [ADR] | N | N |
| [RULE] | N | N |
| **Total** | **N** | **N** |
```

### Step 5: Commit resolution work
Use the impl-commit skill to commit the fixes. The commit message should reference
the review file:

```
fix(review): resolve PR review findings P{N}

Fixes: [FIX] items resolved inline
Tasks: S### added for [TASK] items
ADR-NNNN created for [ADR] items
Rules updated for [RULE] items

Review: Context/Reviews/PR-{branch}-{date}.md
```

### Step 6: Suggest next steps
Based on what was generated:
- If new tasks were added -- "Run impl-start to work through the new tasks"
- If ADRs were created -- "Review the new ADRs to make sure they're complete"
- If rules were updated -- "The updated rules will apply to future code automatically"
- Always -- "Run review-verify to confirm all findings are resolved"

## Rules
- ALWAYS start by loading the review file -- don't work from conversation memory
- Present findings summary and wait for user confirmation before executing
- The category from capture IS the action -- do not re-triage
- If a fix turns out more complex than expected, inform the user and ask whether
  to reclassify as Task or ADR
- Process in priority order within each category: Critical, High, Medium, Low
- If context is getting tight, save progress to the review file immediately
  (update statuses for what's done so far) before continuing
- Keep the review file as the single source of truth -- don't track resolutions
  anywhere else
