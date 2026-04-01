# Skill: Commit Changes

## Purpose
Stage, format, and commit changes with a conventional commit message that references feature context and ADRs.

## When to use
- After completing one or more tasks
- At milestone boundaries
- User says "commit this", "save progress", "commit"

## Workflow

### Step 1: Review changes
1. Run `git status` and `git diff --stat` to see what changed
2. Identify which feature and tasks the changes relate to
3. Check if any changes warrant an ADR (significant deviation from plan)

### Step 2: Format code
Run the appropriate formatter for each changed file's stack:

| Stack | Formatter | Command |
|---|---|---|
| Python | ruff | `ruff format [files] && ruff check --fix [files]` |
| Vue/TypeScript | prettier + eslint | `npx prettier --write [files] && npx eslint --fix [files]` |
| Rust | rustfmt | `cargo fmt` |
| Embedded C/C++ | clang-format | `clang-format -i [files]` |
| Kotlin | ktlint | `./gradlew ktlintFormat` or `ktlint -F [files]` |

### Step 3: Build commit message
Use conventional commit format:

```
type(scope): short description

[optional body — what and why, not how]

Tasks: S001, S002, S003
Feature: NNN-FeatureName
[ADR-NNNN if any decisions were made]
```

**Type:** feat, fix, refactor, test, docs, chore, build, ci
**Scope:** module, component, or stack area affected

### Step 4: Stage and commit
1. Stage relevant files: `git add [files]`
2. Commit with the formatted message
3. Present the commit summary to the user

## Rules
- Never commit without formatting first
- Never commit files with unresolved merge conflicts
- If changes span multiple unrelated tasks, suggest splitting into multiple commits
- Test files commit alongside their implementation (not separately)
- ADR references in commit messages only when an ADR was created for this change
- Do not commit Context/ planning files and source code in the same commit — keep planning commits separate
