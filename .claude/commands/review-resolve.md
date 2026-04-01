---
description: Work through captured review findings by category
model: opus
---

# Review Resolution

Work through a captured review file, resolve each finding by category, generate appropriate planning artifacts, and update the review file with resolution status.

## When to use
- At the start of a fresh session after a review was captured
- User says "resolve review", "fix review findings", "work through the review"
- User references a specific review file in Context/Reviews/

## Workflow

**CRITICAL:** This should run in a **fresh session** with full context budget, not in the same session that performed the review.

### Step 1: Load the review file
1. If user specified a file, load that one
2. Otherwise, list files in `Context/Reviews/` and find the most recent unresolved
3. If no unresolved reviews exist, inform the user
4. Load the associated feature's Spec.md, Steps.md, and Tech.md for context

### Step 2: Work through Fix-Now findings ([FIX])
Process each in priority order (Critical, High, Medium, Low):
1. Open referenced file and line
2. Apply the fix
3. Update finding: Status = Fixed, Resolution = description of change
4. If fix is more complex than expected, reclassify to [TASK] or [ADR]

### Step 3: Work through Missing Task findings ([TASK])
For each finding:
1. Determine next available S### number from Steps.md
2. Add new task to Steps.md in the appropriate phase
3. If related to a Testable Assertion, verify it exists in Spec.md
4. Update finding: Status = Task created, Resolution = S### reference
5. Do NOT implement the task now -- just track it

### Step 4: Work through Architectural Concern findings ([ADR])
For each finding:
1. Present the concern with context (what reviewer found, what Tech.md says)
2. Ask user to decide:
   - **Create ADR** -- use the adr-create skill
   - **Dismiss** -- user provides reason
   - **Defer** -- mark for later consideration
3. Update finding status accordingly

### Step 5: Work through Convention Gap findings ([RULE])
For each finding:
1. Identify which rule file should be updated
2. Present the suggested addition to the user
3. If approved, add to the appropriate rule file
4. Update finding status

### Step 6: Update review file header
After processing all findings, update status and add Resolution Summary table.

### Step 7: Commit resolution work
Use the impl-commit skill. Commit message should reference the review file.

### Step 8: Suggest next steps
- New tasks added -- "Run /impl to work through new tasks"
- ADRs created -- "Review the new ADRs"
- Rules updated -- "Updated rules apply to future code automatically"
- Always -- "Run /review-verify to confirm all findings resolved"
