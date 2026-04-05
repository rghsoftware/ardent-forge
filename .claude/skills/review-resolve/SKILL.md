# Skill: Resolve Review Findings

## Purpose
Work through a captured review file using interactive triage. Every finding requires
an explicit user decision before any action is taken. Claude may recommend an action,
but the user always makes the final call.

## When to use
- At the start of a fresh session after a review was captured
- User says "resolve review", "fix review findings", "work through the review"
- User references a specific review file in Context/Reviews/

## Prerequisites
- A review file must exist in `Context/Reviews/` (created by review-capture)
- This should run in a **fresh session** with full context budget -- not in the same
  session that performed the review

## Actions Reference

Six actions are available for every finding:

| # | Action | Description |
|---|--------|-------------|
| 1 | **Fix** | Open the file and apply the fix inline |
| 2 | **Task** | Add a new S### entry to Steps.md for later implementation |
| 3 | **ADR** | Create an Architecture Decision Record via the adr-create skill |
| 4 | **Rule** | Add or update a convention in the appropriate rule file |
| 5 | **Defer** | Push to an external tracker or the backlog for later |
| 6 | **Discard** | Drop the finding |

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

### Step 2: Bulk accept phase
List every finding with its ID, severity, and title so the user can see what
they are deciding on. Group by category.

```
## Findings

### [FIX] -- 6 findings
  P1-001 (Critical) Missing null check in auth handler
  P1-002 (Critical) SQL injection in search query
  P1-004 (High)     Unclosed file handle in export
  P1-005 (High)     Wrong HTTP status on validation error
  P1-007 (Medium)   Inconsistent error message format

### [TASK] -- 5 findings
  P1-003 (High)     No integration test for payment flow
  P1-008 (Medium)   Missing rate limiting on public API
  P1-009 (Medium)   Accessibility labels missing on form inputs
  P1-010 (Medium)   No migration rollback script
  P1-012 (Low)      Add changelog entry for breaking change

### [ADR] -- 2 findings
  P1-006 (High)     Auth middleware stores tokens in localStorage
  P1-011 (Medium)   Tight coupling between order and inventory services

### [RULE] -- 3 findings
  P1-013 (Low)      Bare except clauses in 4 files
  P1-014 (Low)      No structured logging -- raw print() in 6 files
  P1-015 (Low)      Inconsistent import ordering across modules

Total: 16 findings

Accept suggested actions in bulk?
  1. Accept all -- apply each finding's category as its action (fix 6, task 5, adr 2, rule 3)
  2. Accept all [FIX]
  3. Accept all [TASK]
  4. Accept all [ADR]
  5. Accept all [RULE]
  6. Skip -- go straight to individual triage

You can accept multiple groups. Type "done" when ready for individual triage.
```

The category assigned during capture IS the suggested action. Bulk accept means
"yes, do what the category says" for a group of findings at once.

**CRITICAL:** Always list findings by title, not just counts. The user needs to
see what each finding IS to decide whether to bulk-accept or individually triage.

**Bulk accept rules:**
- The user may accept multiple groups before typing "done"
- After each bulk accept, immediately update ALL affected findings in the review
  file on disk (batch write)
- Show a confirmation after each accept: "Accepted N [CATEGORY] findings.
  Remaining: M unhandled."
- When the user types "done" or "skip", proceed to Step 3

### Step 3: Individual triage phase
Process each remaining unhandled finding one at a time. For each finding, present:

```
Finding [X of Y remaining]: [CATEGORY] Severity
File: path/to/file.ts:NN
Description: <the finding text>

Recommended action: <Claude's recommendation with brief rationale>

Actions:
  1. Fix     -- apply the fix now
  2. Task    -- add to Steps.md
  3. ADR     -- create architecture decision record
  4. Rule    -- add/update convention rule
  5. Defer   -- send to tracker or backlog
  6. Discard -- drop this finding

Choose [1-6]:
```

**Individual triage rules:**
- Wait for the user to respond with a number (1-6) before proceeding
- NEVER auto-resolve, auto-dismiss, or skip a finding
- If the user picks **6 (Discard)**, proceed immediately. No reason required.
- After the user picks an action, record the decision against the finding
- Immediately update the review file on disk after each individual decision
- Continue to the next finding until all are handled

### Step 4: Execution phase
After all findings have been triaged (bulk + individual), execute each action.
Process in this order: Fix, Task, ADR, Rule, Defer, Discard.

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

#### Defer
1. Check `.cortex/config.json` for an `issueTracker` configuration:
   - If `issueTracker.type` is `"github"`: run `gh issue create --title "<finding summary>" --body "<finding details>"`
   - If `issueTracker.type` is `"gitlab"`: run `glab issue create --title "<finding summary>" --description "<finding details>"`
   - If `issueTracker.type` is `"backlog"` or no config file exists: create an entry
     in `Context/Backlog/` with the finding details
2. Update the finding in the review file:
   - **Status:** Deferred
   - **Resolution:** {Issue URL or "Added to Context/Backlog/<filename>"}

#### Discard
1. Mark the finding in the review file:
   - **Status:** Discarded
   - **Resolution:** Discarded by user

### Step 5: Update review file header
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

| Category | Total | Fixed | Tasks | ADRs | Rules | Deferred | Discarded |
|---|---|---|---|---|---|---|---|
| [FIX] | N | N | N | -- | -- | N | N |
| [TASK] | N | -- | N | -- | -- | N | N |
| [ADR] | N | -- | -- | N | -- | N | N |
| [RULE] | N | -- | -- | -- | N | N | N |
| **Total** | **N** | | | | | | |
```

### Step 6: Commit resolution work
Use the impl-commit skill to commit the fixes. The commit message should reference
the review file:

```
fix(review): resolve PR review findings P{N}

Fixes: [FIX] items resolved inline
Tasks: S### added for [TASK] items
ADR-NNNN created for [ADR] items
Rules updated for [RULE] items
Deferred: N items pushed to tracker/backlog
Discarded: N items dropped

Review: Context/Reviews/PR-{branch}-{date}.md
```

### Step 7: Suggest next steps
Based on what was generated:
- If new tasks were added -- "Run impl-start to work through the new tasks"
- If ADRs were created -- "Review the new ADRs to make sure they're complete"
- If rules were updated -- "The updated rules will apply to future code automatically"
- If items were deferred -- "Check the tracker/backlog for deferred items"
- Always -- "Run review-verify to confirm all findings are resolved"

## Rules
- ALWAYS start by loading the review file -- don't work from conversation memory
- NEVER take action on a finding without an explicit user decision (bulk or individual)
- NEVER auto-resolve, auto-dismiss, or skip findings
- Claude SHOULD recommend an action for each finding, but the user makes the final call
- Discard does NOT require a reason
- Bulk accept phase MUST come before individual triage phase
- After each individual decision, immediately update the review file on disk
- After each bulk accept, batch-update all affected findings on disk
- Within individual triage, process in priority order: Critical, High, Medium, Low
- If context is getting tight, save progress to the review file immediately
  (update statuses for what's done so far) before continuing
- Keep the review file as the single source of truth -- don't track resolutions
  anywhere else
