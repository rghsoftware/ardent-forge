---
description: Work through captured review findings with interactive triage
model: sonnet
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

### Step 2: Bulk accept
Present a summary table of findings grouped by category and severity. Offer to accept suggested actions in bulk -- the category from capture IS the suggested action. User can accept all, accept by category, or skip to individual triage. Update all affected findings on disk after each bulk accept.

### Step 3: Individual triage
Process each remaining finding one at a time. For each, show the finding details and Claude's recommended action, then present a numbered menu:

1. **Fix** -- apply the fix inline
2. **Task** -- add S### entry to Steps.md
3. **ADR** -- create architecture decision record
4. **Rule** -- add/update convention in rule file
5. **Defer** -- push to tracker (`.cortex/config.json`) or backlog
6. **Discard** -- drop the finding

Wait for the user's choice before proceeding. Save progress to the review file after each decision.

**Advisor consult on ambiguous findings.** When the recommended action is not obvious (for example: a finding that could plausibly be Fix, Task, or ADR depending on blast radius), write a question file and consult the Advisor before presenting the menu:

```bash
cat > /tmp/cortex-triage-<id>.md <<'EOF'
Finding [ID] from [review file]:
[verbatim finding text]

Files referenced:
[list]

Category from capture: [FIX/TASK/ADR/RULE]

Question: is this best handled as (1) Fix inline, (2) Task in Steps.md,
(3) ADR, or (4) Rule addition? Which option and why, in <=100 words,
as enumerated bullets.
EOF

bun run .claude/hooks/advisor/advisor-cli.ts --question-file /tmp/cortex-triage-<id>.md
```

Exit 0: present the Advisor's recommendation alongside the numbered menu as Claude's suggestion. Exit 2: present the menu without an Advisor suggestion. Either way, the user decides.

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
- Discard does not require a reason
- Bulk accept phase comes before individual triage phase
- The review file is the single source of truth

See `core/skills/review-resolve/SKILL.md` for full workflow details.
