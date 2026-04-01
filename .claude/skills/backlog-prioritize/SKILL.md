# Skill: Prioritize Backlog

## Purpose
Review and re-prioritize the backlog, promoting items to planned features.

## When to use
- Between features, when deciding what to build next
- User says "what should we work on next", "prioritize the backlog", "review backlog"

## Workflow

### Step 1: Load backlogs
1. Read `Context/Backlog/Ideas.md` and `Context/Backlog/Bugs.md`
2. Read existing features in `Context/Features/` for context on what's already planned

### Step 2: Present summary
List all backlog items grouped by priority (High → Medium → Low), with a one-line summary each.

### Step 3: Discuss with user
- Ask which items to promote, defer, or drop
- For items to promote: suggest whether they need the full 4-phase workflow or a quick plan
- For items to drop: confirm before removing

### Step 4: Update
- Move promoted items out of backlog — the next step is plan-spec or plan-quick
- Update priorities on remaining items if the user changed them
- Remove dropped items (mark as `~~dropped~~` rather than deleting, for history)

## Rules
- Never auto-prioritize without user input — present options, let the user decide
- High-priority bugs should be flagged as "consider addressing before next feature"
- If the backlog has >20 items, suggest a cleanup session
