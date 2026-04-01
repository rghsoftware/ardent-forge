---
description: Initialize project for Cortex workflow
model: sonnet
---

# Setup Cortex

Initialize this project for the Cortex workflow. Detects stacks, creates scaffolding, and configures the project.

## When to use
- First time using Cortex in a project
- User says "set up cortex", "initialize cortex", "cortex setup"
- After running `bun run deploy` to install Cortex files

## Workflow

### Step 1: Detect stacks

Scan project for these indicators:

| Stack | Look for |
|---|---|
| Python/FastAPI | `requirements.txt`, `pyproject.toml`, `Pipfile`, `*.py` in source dirs, `fastapi` in deps |
| Vue.js/TypeScript | `package.json` with `vue`, `*.vue` files, `tsconfig.json`, `vite.config.ts` |
| React/Next.js | `package.json` with `react` or `next`, `*.jsx`/`*.tsx` files |
| Rust/Tauri | `Cargo.toml`, `*.rs`, `tauri.conf.json`, `src-tauri/` |
| Embedded C/C++ | `CMakeLists.txt` with ESP-IDF/Pico, `sdkconfig`, `platformio.ini`, `*.c`/`*.h` in firmware dirs |
| C++/Qt | `CMakeLists.txt` with `find_package(Qt6)`, `*.qml` files, `qt_add_executable` |
| Kotlin/KMP | `build.gradle.kts` with Kotlin plugin, `*.kt`, multiplatform in settings.gradle |
| Svelte/SvelteKit | `package.json` with `svelte`, `*.svelte` files |
| Supabase | `supabase/` directory, `.env` with Supabase keys |

Record which stacks were detected and their directories.

### Step 2: Confirm with user

Present detected stacks and directories. Let the user:
- Correct misdetections
- Add stacks not auto-detected
- Adjust directory paths
Wait for confirmation before proceeding.

### Step 3: Create Context/ scaffolding

Create the `Context/` directory structure if it does not already exist:
```
Context/
  Features/
  Decisions/
  Reviews/
  Backlog/
    Ideas.md
    Bugs.md
```

Create `.cortex/archive/` if not present.

### Step 4: Create or update CLAUDE.md

If `CLAUDE.md` does not exist, create it using the Cortex template from `core/templates/project-init/`.

If `CLAUDE.md` already exists, check if it contains a Cortex workflow section.
If not, append the workflow section. If it does, leave it alone.

The workflow section should include:
- Development workflow (4-phase planning, complexity routing)
- Available commands reference
- Context management notes
- Detected stacks and their conventions

### Step 5: Create stack rules

For each detected stack, check if a corresponding rule file exists in `.claude/rules/`.
If not, create one with conventions for that stack:

- File naming conventions
- Import/module organization
- Error handling patterns
- Test framework and conventions
- Linting/formatting tools

Use the stack's QA agent prompt (from `core/agents/qa-*.md`) as a reference for
what conventions matter for that stack.

### Step 6: Verify hooks

Check that Cortex hooks are wired in `.claude/settings.json`:
- UserPromptSubmit: skill-activation hook
- PreCompact: context-recovery hook
- PostToolUse: formatter hook

If hooks are missing, inform the user and suggest running `bun run deploy` to install them,
or offer to add them via the merge-settings script.

### Step 7: Summary

Present what was created/verified:
- Stacks detected
- Context/ directories created
- CLAUDE.md status (created or updated)
- Stack rules created
- Hooks status

Suggest next steps:
1. Review the generated CLAUDE.md
2. Start planning with `/blueprint "feature description"`
3. Use `/quick` for smaller tasks
4. Use `/qa` to run quality checks against detected stacks
