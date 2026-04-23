---
description: Add to or prioritize the backlog
model: sonnet
---

# Backlog Management

Add ideas or bugs to the backlog, or prioritize existing items. Keeps track of future work and known issues.

## When to use
- User has a new idea for a feature or improvement
- A bug is discovered but isn't blocking current work
- User says "add to backlog", "track this bug", "prioritize backlog"
- Planning what to work on next

## Model Routing

This command routes to the build agent:

| Environment | Model | Rationale |
|---|---|---|
| Claude Code (work) | opus | Backlog management is straightforward |
| OpenCode (home) | glm-4.7-flash | Quick categorization and prioritization |

## Workflow

### Step 1: Determine action
If $ARGUMENTS is empty, default to `list` (show all open backlog items).

Otherwise, the first parameter ($1) indicates what action to take:
- `list` — Show all open items from Ideas.md and Bugs.md (default when no args)
- `add` — Add a new item to Ideas.md or Bugs.md
- `prioritize` — Order existing items by priority
- `move` — Move items between Ideas and Bugs
- `remove` — Remove resolved items

Additional details provided via $ARGUMENTS.

### Step 2: For `list` action (default)
1. Load Context/Backlog/Ideas.md and Context/Backlog/Bugs.md
2. Display all open items, grouped by file (Ideas / Bugs)
3. Show priority level if present
4. Suggest next actions: add an item, prioritize, or start planning a high-priority item

### Step 3: For `add` action
1. If $ARGUMENTS provided, it contains the item description
2. If no $ARGUMENTS, ask user for the item description
3. Determine if item is an idea or a bug
4. Load appropriate file: Context/Backlog/Ideas.md or Context/Backlog/Bugs.md
5. Append entry with:
   - Brief description (from $ARGUMENTS or user input)
   - Stack/area affected (if known)
   - Initial priority (optional)
6. Confirm entry was added

### Step 4: For `prioritize` action
1. Load both Ideas.md and Bugs.md
2. Present current items
3. Ask user to reorder by priority
4. Optionally ask for priority levels (high/medium/low)
5. Save reordered lists

### Step 5: For `move` action
1. Load both backlogs
2. Present items
3. Ask which item to move and to which file
4. Move item between files

### Step 6: For `remove` action
1. Load appropriate backlog file
2. Present items
3. Ask which to remove
4. Remove entry and save file
5. Optionally ask to archive to Done/ instead

### Step 7: Summary
Present the updated backlog and suggest next steps:
- Start planning a high-priority item
- Continue current implementation
- Review backlog for quick wins
