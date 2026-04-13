---
description: Lightweight single-file plan for small tasks
model: sonnet
---

# Quick Plan

Generate a lightweight, single-file plan for small tasks or exploratory work. Skips full 4-phase workflow.

## When to use
- Tasks that don't require full spec-tech-steps planning
- Exploratory work or research spikes
- Quick fixes that still need some structure
- User says "quick plan this", "lightweight plan", "small task"

## Model Routing

This command routes to a lower-cost model tier for rapid planning:

| Environment | Model | Rationale |
|---|---|---|
| Claude Code (work) | haiku | Quick plans are simple — haiku sufficient for structured output |
| OpenCode (home) | gemini-2.5-flash | Fast and cheap for lightweight planning |

## Workflow

**CRITICAL:** If $ARGUMENTS is empty, STOP here and ask user: "What task would you like a quick plan for?" Do NOT proceed with any operations until a description is provided.

### Step 1: Understand task
1. If $ARGUMENTS is NOT empty, user has described the task: "$ARGUMENTS"
2. If $ARGUMENTS is empty, ask: "What would you like me to create a quick plan for?"
3. Do NOT read files or search project until description is obtained
4. Clarify scope: bug fix, small feature, research spike, refactor
5. Confirm task qualifies for quick plan (not a major feature)

### Step 2: Generate quick plan
1. Create `Context/QuickPlans/YYYY-MM-DD-TaskName.md`
2. Structure:
   - **Task:** [description]
   - **Goal:** [what to achieve]
   - **Approach:** [how to do it]
   - **Verification:** [how to know it's done]
   - **Risks:** [what could go wrong]

### Step 3: Review with user
1. Present the quick plan
2. Confirm or adjust approach

### Step 4: Suggest execution command
ALWAYS end by recommending the most appropriate execution command:
- `/impl` -- default for most quick tasks (hub-and-spoke sub-agent orchestration)
- `/team-impl` -- when the task spans multiple stacks with tight integration points (peer-to-peer Agent Teams)

Quick plans typically use `/impl` since they are smaller in scope.

### Step 5: Archive the QuickPlan
When the task is complete, archive the plan so it does not accumulate in the active folder:
1. Create `Context/QuickPlans/Done/` if it does not exist
2. Move the plan file from `Context/QuickPlans/` to `Context/QuickPlans/Done/`
3. Confirm the move to the user

Do NOT skip this step or leave it as a suggestion. Perform the move directly.
