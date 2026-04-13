---
description: Run stack-specific QA agents in parallel
model: sonnet
effort: medium
---

# Parallel Quality Assurance

Run stack-specific QA agents in parallel across all detected stacks in the project.

## Workflow

### Step 1: Detect stacks
Scan project for stack indicators:

| Stack | Look for |
|---|---|
| Python/FastAPI | `requirements.txt`, `pyproject.toml`, `Pipfile`, `*.py` in source dirs, `fastapi` in deps |
| Vue.js/TypeScript | `package.json` with `vue`, `*.vue` files, `tsconfig.json`, `vite.config.ts` |
| Rust/Tauri | `Cargo.toml`, `*.rs`, `tauri.conf.json`, `src-tauri/` |
| Embedded C/C++ | `CMakeLists.txt` with ESP-IDF/Pico, `sdkconfig`, `platformio.ini`, `*.c`/`*.h` in firmware dirs |
| C++/Qt | `CMakeLists.txt` with `find_package(Qt6)`, `*.qml` files, `qt_add_executable`, `*.ui` files, `QT` in `target_link_libraries` |
| Kotlin/KMP | `build.gradle.kts` with Kotlin plugin, `*.kt`, multiplatform in settings.gradle |

### Step 2: Map stacks to agents

| Stack | Agent |
|---|---|
| Python/FastAPI | qa-python |
| Vue.js/TypeScript | qa-vue |
| Rust/Tauri | qa-rust |
| Embedded C/C++ | qa-embedded |
| C++/Qt 6 | qa-cpp-qt |
| Kotlin/KMP | qa-kotlin |

### Step 3: Spawn agents in parallel
For each detected stack, invoke the corresponding QA agent as a background subagent.

### Step 4: Collect and summarize
1. Wait for all agents to complete
2. Aggregate findings into a structured report:
   - Stack name
   - Issues found (errors, warnings, suggestions)
   - Files affected
   - Actions recommended

### Step 5: Present summary
Display aggregated report to user. Offer to:
- Fix issues (run `/impl` and create tasks)
- Mark as reviewed (if no blocking issues)
- Run again after fixes

**Note:** If $ARGUMENTS provided, use as additional context to scope the review.
