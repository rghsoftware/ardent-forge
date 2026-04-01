# Skill: Quick Plan

## Purpose
Lightweight planning for small tasks that don't warrant the full 4-phase workflow. Produces a single markdown file instead of Spec.md + Tech.md + Steps.md.

## When to use
- Bug fixes, small improvements, config changes
- Tasks completable in a single session
- User says "quick fix", "just do this small thing", "quick plan"

## Prerequisites
- User has described the task
- Project CLAUDE.md exists

## Workflow

### Step 1: Load context
1. Read `CLAUDE.md` for project architecture
2. Check if this task relates to an existing feature in `Context/Features/`
3. Read active `.claude/rules/` for the stack this task touches

### Step 2: Determine task number
1. List existing files in `Context/Features/`
2. Find the highest NNN prefix
3. Assign NNN+1

### Step 3: Write the quick plan
1. Create `Context/Features/NNN-TaskName.md` (single file, not a directory)
2. Use the template below

### Step 4: Confirm and proceed
1. Present the plan to the user
2. If approved, proceed directly to implementation (no separate impl-start needed)

## Quick Plan Template

```markdown
# Quick Task NNN: [Task Name]

## Understanding
[Claude's interpretation of what needs to happen and why]

## In Scope
- [What this task will do]

## Out of Scope
- [What this task will NOT do, to prevent creep]

## Implementation
1. [Step — specific enough to execute without ambiguity]
2. [Step]
3. [Step]

## Tests & Docs
- **Tests:** [What to test and key scenarios, OR "None needed — [reason]"]
- **Docs:** [What to update, OR "None needed — [reason]"]
```

## Rules
- Quick plans are for tasks estimated at under ~1 hour of implementation
- If the task grows beyond 5 implementation steps, suggest upgrading to the full 4-phase workflow
- Tests & Docs section is always present — can say "None needed" but must give a reason
- Quick plans do NOT create ADRs unless the task changes an architectural decision
- The quick plan file lives at the Features root as a single .md file, not in a subdirectory
