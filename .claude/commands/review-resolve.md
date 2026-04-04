---
description: Work through captured review findings with interactive triage
model: opus
---

# Review Resolution

Interactively triage and resolve review findings. Claude recommends actions, but the user makes every decision.

## When to use
- At the start of a fresh session after a review was captured
- User says "resolve review", "fix review findings", "work through the review"
- User references a specific review file in Context/Reviews/

## Workflow

**CRITICAL:** Run in a **fresh session** with full context budget -- not the session that performed the review.

### Step 1: Load the review file
Find the specified or most recent unresolved review in `Context/Reviews/`. Load associated Spec.md, Steps.md, and Tech.md for context. Parse all findings into a working list.

### Step 2: Bulk triage
Present a summary table of findings grouped by category and severity. Offer bulk actions using `<action> <filter>` format (e.g., `fix all [FIX] Critical`, `discard all [RULE] Low`). The user may issue multiple bulk actions before typing "done" to proceed. Update all affected findings on disk after each bulk action.

### Step 3: Individual triage
Process each remaining finding one at a time. For each, show the finding details and Claude's recommended action, then present a numbered menu:

1. **Fix** -- apply the fix inline
2. **Task** -- add S### entry to Steps.md
3. **ADR** -- create architecture decision record
4. **Rule** -- add/update convention in rule file
5. **Defer** -- push to tracker (`.cortex/config.json`) or backlog
6. **Discard** -- drop the finding (reason required for individual; not for bulk)

Wait for the user's choice before proceeding. Save progress to the review file after each decision.

### Step 4: Execute actions
Process all triaged findings in order: Fix, Task, ADR, Rule, Defer, Discard. Update each finding's status and resolution in the review file.

### Step 5: Finalize
Update the review file header and add a Resolution Summary table. Commit via impl-commit skill referencing the review file.

### Step 6: Suggest next steps
- New tasks -- "Run /impl to work through new tasks"
- ADRs created -- "Review the new ADRs"
- Rules updated -- "Updated rules apply to future code automatically"
- Items deferred -- "Check the tracker/backlog for deferred items"
- Always -- "Run /review-verify to confirm all findings resolved"

## Key rules
- NEVER auto-resolve, auto-dismiss, or skip findings
- Claude recommends but user decides
- Individual discard requires a reason; bulk discard does not
- Bulk triage phase comes before individual triage phase
- The review file is the single source of truth

See `core/skills/review-resolve/SKILL.md` for full workflow details.
