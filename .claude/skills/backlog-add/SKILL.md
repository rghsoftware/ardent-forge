# Skill: Add to Backlog

## Purpose
Add ideas or bugs to the project backlog for future planning.

## When to use
- User mentions a future idea or enhancement during implementation
- User reports a bug that isn't blocking current work
- User says "add to backlog", "track this idea", "log this bug"

## Workflow

### Step 1: Determine type
- **Idea** → append to `Context/Backlog/Ideas.md`
- **Bug** → append to `Context/Backlog/Bugs.md`
- If unclear, ask the user

### Step 2: Add entry
Append to the appropriate file using this format:

```markdown
### [Short title]
**Added:** YYYY-MM-DD
**Context:** [1-2 sentences — what and why]
**Related:** [feature, file, or area if known]
**Priority:** [Low | Medium | High — user's initial estimate]
```

### Step 3: Confirm
Tell the user what was added and to which backlog.

## Rules
- Backlog entries are append-only — never reorganize or delete entries in this skill
- If the backlog file doesn't exist, create it with a header: `# Ideas Backlog` or `# Bugs Backlog`
- Don't over-document — 1-2 sentences of context is enough for future recall
- If the bug is blocking current work, suggest creating a quick plan instead
