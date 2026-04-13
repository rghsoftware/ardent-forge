---
description: Git commit with conventional format and task references
model: sonnet
---

# Commit Changes

Prepare a commit message following conventional commits format. References tasks and ADRs from planning artifacts.

## When to use
- After completing implementation work
- User says "commit this", "prepare commit message", "commit changes"
- After milestone checkpoint verification
- Anytime code is ready to be committed

## Model Routing

This command routes to the build agent:

| Environment | Model | Rationale |
|---|---|---|
| Claude Code (work) | opus | Commit messages need clarity and precision |
| OpenCode (home) | glm-4.7-flash | Standardized commit message generation |

## Workflow

### Step 1: Load impl-commit skill
This command is a thin wrapper around the impl-commit skill. Load and follow the skill's workflow.

The impl-commit skill handles:
1. Git status analysis
2. Logical change grouping
3. Conventional commit format
4. Task and ADR referencing

### Step 2: Follow impl-commit skill
See `core/skills/impl-commit/SKILL.md` for detailed workflow.

Briefly:
1. Get git status (unstaged, staged, recent commits)
2. Analyze changes and group logically
3. Draft commit message with:
   - Type (feat, fix, refactor, test, docs, chore, build, ci)
   - Scope (affected component or stack)
   - Description (clear, concise)
   - Task references (Tasks: S001, S002)
   - ADR references (ADR-0003)
4. Present for user approval
5. If approved, stage files and create commit

### Step 3: Confirm commit
After commit is created:
- Present commit hash and message
- Suggest next steps
  - Continue implementation
  - Start testing
  - Update documentation
  - Review and verify

### Step 4: Archive completed QuickPlans
After a successful commit, check for active QuickPlans:
1. Scan `Context/QuickPlans/` for `.md` files (ignore `Done/` subdirectory)
2. If none found, skip this step silently
3. If plans are found, list them and ask: "Archive these completed QuickPlans?"
4. If confirmed, move each plan to `Context/QuickPlans/Done/` (create the directory if needed)
