# Skill: Project Initialization Templates

## Purpose
Provides all template content needed by the `/context-engine:init` command.
This skill is not invoked directly — it's a reference library.

## Templates

### shared-conventions.md (always created, no paths frontmatter)

```markdown
# Shared Conventions

These conventions apply to all code regardless of stack.

## Git
- Conventional commits: `type(scope): description`
- Types: feat, fix, refactor, test, docs, chore, build, ci
- Commit messages reference task numbers: `Tasks: S001, S002`
- Commit messages reference ADRs when applicable: `ADR-0003`
- One logical change per commit — don't mix unrelated changes
- Planning artifacts (Context/) committed separately from source code

## Code Organization
- One responsibility per file — if a file does two unrelated things, split it
- Public API surface should be minimal — don't export internals
- Dead code gets deleted, not commented out (git has history)
- No secrets in source code — use environment variables or secret managers

## Documentation
- Public functions/methods get documentation comments
- Complex algorithms get inline comments explaining *why*, not *what*
- README.md at project root covers setup, build, and run instructions
- Architecture decisions go in Context/Decisions/ as ADRs

## Planning Workflow
- Features use the 4-phase workflow: Spec → Tech → Steps → Implementation
- Small tasks use quick plans
- Every deviation from spec gets an ADR
- Milestone checkpoints verify alignment with Testable Assertions
- Test and documentation tasks are planned, not afterthoughts

## Error Messages
- Error messages should help the user fix the problem
- Include what went wrong, what was expected, and what to try
- Never expose internal stack traces to end users
- Log the full error context for debugging
```

---

### python-fastapi.md

Frontmatter (substitute real directory):
```yaml
---
paths:
  - "[detected-python-dir]/**"
  - "**/*.py"
---
```

```markdown
# Python/FastAPI Conventions

## Language & Runtime
- Python 3.11+ required
- Type annotations on all public function signatures
- `from __future__ import annotations` at top of every module

## Code Style
- Formatter: ruff format
- Linter: ruff check
- Line length: 88 (ruff default)
- Import sorting: ruff isort rules (stdlib → third-party → local)
- Docstrings: Google style on all public functions and classes

## FastAPI Patterns
- All endpoints must declare `response_model`
- Use dependency injection for database sessions, config, and auth
- Async endpoints must actually await something — use `def` for sync operations
- Pydantic v2: use `model_config` dict, not `class Config`
- Error responses via `HTTPException` with explicit status codes
- Request validation via Pydantic models, not manual parsing

## Database
- SQLAlchemy 2.0 style with `select()` statements, not legacy `query()`
- Alembic for migrations — never modify database schema outside migrations
- All queries parameterized — no string formatting for SQL

## Testing
- Framework: pytest with httpx AsyncClient
- Test files: `test_[module].py` in a `tests/` directory mirroring source structure
- Fixtures for database setup/teardown
- Use `pytest.mark.parametrize` for edge case coverage
- Async tests: use `@pytest.mark.anyio` or `pytest-asyncio`

## Error Handling
- Never bare `except:` — always specify exception type
- Log exceptions with structured context before re-raising
- Use custom exception classes for domain-specific errors
- `try/except` blocks should be as narrow as possible
```

---

### vue-typescript.md

Frontmatter (substitute real directory):
```yaml
---
paths:
  - "[detected-vue-dir]/**"
  - "**/*.vue"
  - "**/*.ts"
  - "**/*.tsx"
---
```

```markdown
# Vue.js/TypeScript Conventions

## Language & Framework
- Vue 3 with Composition API (`<script setup>` preferred)
- TypeScript strict mode enabled
- No Options API in new code

## Code Style
- Formatter: prettier
- Linter: eslint with @vue/eslint-config-typescript
- Component naming: PascalCase for files and usage
- Composables: `use[Name].ts` prefix, return typed objects

## Component Patterns
- Props: `defineProps<{}>()` with TypeScript interface
- Emits: `defineEmits<{}>()` with typed events
- State: `ref()` for primitives, `reactive()` for objects
- Computed: `computed()` for derived state, never side effects
- Watchers: `watch()` / `watchEffect()` with cleanup when needed
- Template refs: `useTemplateRef()` with typed ref

## State Management
- Pinia for global state
- Stores: `defineStore()` with setup syntax (composable-style)
- No direct store mutation from components — use store actions
- Keep stores focused — split by domain, not by page

## Styling
- Tailwind CSS utility classes preferred
- Scoped styles (`<style scoped>`) when Tailwind isn't sufficient
- No inline styles except for truly dynamic values

## Testing
- Framework: Vitest + Vue Test Utils
- Test files: `[Component].test.ts` colocated with component
- Mount components with `mount()` or `shallowMount()`
- Test behavior, not implementation details
- Mock API calls, don't hit real endpoints

## Accessibility
- All images need `alt` attributes
- Interactive elements must be keyboard accessible
- Icon-only buttons need `aria-label`
- Form inputs need associated labels
- Color is never the sole indicator of state
```

---

### rust-tauri.md

Frontmatter (substitute real directory):
```yaml
---
paths:
  - "[detected-rust-dir]/**"
  - "**/*.rs"
---
```

```markdown
# Rust/Tauri Conventions

## Language
- Rust stable channel (latest)
- Edition 2021
- Clippy: `cargo clippy -- -D warnings` must pass

## Code Style
- Formatter: rustfmt (default configuration)
- `use` imports: grouped by std → external crates → internal modules
- Error types: `thiserror` for library errors, `anyhow` for application errors
- Naming: snake_case for functions/variables, PascalCase for types, SCREAMING_SNAKE for constants

## Patterns
- Prefer `?` operator over `unwrap()` in application code
- `unwrap()` acceptable in tests and after explicit validation
- Every `unsafe` block must have a `// SAFETY:` comment explaining the invariant
- `clone()` on large types needs a comment justifying it
- Prefer iterators over indexed loops
- Use `#[must_use]` on functions where ignoring the return value is likely a bug

## Tauri-Specific
- All `#[tauri::command]` handlers must validate inputs before processing
- Capability permissions: least-privilege — request only what's needed
- IPC: return `Result<T, String>` from commands for proper error propagation
- State: use `tauri::State<>` for shared state, not global statics
- Windows: scope file system access to app directories
- CSP: configure in `tauri.conf.json`, no `unsafe-inline` for scripts

## Async
- Tokio runtime for async operations
- Never block inside async functions
- `JoinHandle` errors must be handled
- Use `tokio::select!` for concurrent operations with cancellation

## Testing
- Unit tests: `#[cfg(test)]` module in each source file
- Integration tests: `tests/` directory at crate root
- Mock external dependencies — don't hit real APIs in tests
```

---

### embedded-c.md

Frontmatter (substitute real directory):
```yaml
---
paths:
  - "[detected-firmware-dir]/**"
  - "**/*.c"
  - "**/*.h"
---
```

```markdown
# Embedded C/C++ Conventions (ESP32 / RP2350)

## Language
- C11 for core firmware, C++17 where C++ is used
- No dynamic allocation in ISR context
- All buffers must have compile-time bounds

## Code Style
- Formatter: clang-format
- Types: `stdint.h` exclusively (`uint32_t`, not `unsigned long`)
- Naming: snake_case for functions/variables, ALL_CAPS for macros and constants
- Header guards: `#pragma once` or traditional `#ifndef` guards
- One function per responsibility — keep functions under 50 lines where practical

## Memory Safety
- No `malloc`/`free` in interrupt handlers
- `snprintf` over `sprintf`, `strncpy` over `strcpy` — always
- Stack sizes explicitly set per FreeRTOS task
- Use `uxTaskGetStackHighWaterMark()` in debug builds to verify stack sizing
- No VLAs (variable-length arrays) — use fixed buffers

## Interrupt Safety — ESP32
- ISR functions must be `IRAM_ATTR`
- Shared variables: `volatile` + `portMUX_TYPE` spinlock
- Use `taskENTER_CRITICAL_ISR` / `taskEXIT_CRITICAL_ISR` in ISR context
- Keep critical sections minimal — no FreeRTOS API calls inside
- Use `FromISR` variants of FreeRTOS functions in ISR context

## Interrupt Safety — RP2350
- `critical_section_enter()` / `critical_section_exit()` must be paired
- Multicore shared data protected by mutex
- PIO programs: instruction count must not exceed 32

## FreeRTOS Patterns
- Task creation: always specify stack size based on measured requirements
- Queue operations: always use timeout, never infinite wait in production
- Semaphores: prefer counting semaphores for resource pools
- No `vTaskDelay(0)` — use `taskYIELD()` for clarity

## Testing
- Framework: Unity test framework for logic modules
- Mock HAL layer for hardware abstraction testing
- Test on host (native) where possible, target for hardware-specific behavior

## Build
- CMake-based build system (ESP-IDF or Pico SDK)
- Warnings as errors: `-Wall -Wextra -Werror`
- Static analysis: cppcheck as part of CI
```

---

### cpp-qt.md

Frontmatter (substitute real directory):
```yaml
---
paths:
  - "[detected-qt-dir]/**"
  - "**/*.cpp"
  - "**/*.hpp"
  - "**/*.h"
  - "**/*.qml"
  - "**/*.ui"
---
```

```markdown
# C++/Qt 6 Conventions (Widgets + QML)

## Language & Build
- C++17 minimum (C++20 preferred where Qt 6 supports it)
- Build system: CMake with qt_add_executable / qt_add_library
- CMAKE_AUTOMOC, CMAKE_AUTORCC, CMAKE_AUTOUIC enabled
- Qt6 found via find_package(Qt6 REQUIRED COMPONENTS ...) listing all used modules
- Compiler warnings: -Wall -Wextra -Wpedantic at minimum

## Code Style
- Formatter: clang-format (Qt-compatible profile)
- Linter: clang-tidy with bugprone-*, cppcoreguidelines-*, modernize-*, performance-*, qt-*
- QML formatter: qmlformat
- Naming: camelCase for functions/variables, PascalCase for classes, SCREAMING_SNAKE for constants/enums
- Header guards: #pragma once
- Include order: Qt headers → standard library → third-party → project local

## Qt Object Model
- All QObject subclasses must include Q_OBJECT macro
- Signal/slot connections: pointer-to-member-function syntax only — no SIGNAL()/SLOT() macros
- Lambda connections must include receiver context object to prevent dangling calls
- Use QSignalBlocker instead of manual blockSignals(true)/blockSignals(false) pairs
- QObject-derived types: heap-allocated with parent ownership or explicit std::unique_ptr
- Type casting: qobject_cast for QObject-derived types, never static_cast

## Memory & Lifetime
- No raw new without parent or smart pointer wrapper
- Never delete a parented QObject manually — the parent owns the lifecycle
- Lambda captures of `this` in connect() require the QObject context parameter
- Prefer std::unique_ptr for non-QObject resources
- Prefer QScopedPointer or std::unique_ptr for pimpl idioms

## QML Patterns
- Expose C++ types to QML via QML_ELEMENT or QML_SINGLETON macros
- Use required properties instead of context properties for data passing
- Keep JavaScript in QML under 10 lines — move logic to C++ backend
- Type all QML properties explicitly (property int, not var)
- Use qt_add_qml_module in CMake for QML module registration
- Anchors and manual x/y positioning must not be mixed on the same item

## Concurrency
- Threading: QThread or QtConcurrent, never std::thread (misses event loop)
- Mutex locking: QMutexLocker RAII guard, never manual lock/unlock
- Cross-thread QObject access via signals/slots (Qt::QueuedConnection) or QMetaObject::invokeMethod
- Never call QThread::sleep on the main thread
- moveToThread() only on parentless QObjects

## Testing
- Framework: Qt Test (QTest) with QCOMPARE, QVERIFY, QTEST_MAIN
- Test files: tst_[classname].cpp in a tests/ directory
- Use QSignalSpy for signal emission verification
- Use QTest::mouseClick, QTest::keyClick for UI interaction tests
- Mock network via QNetworkAccessManager subclass or test server
- ASAN and UBSAN enabled in debug/CI builds via CMake option
- Valgrind memcheck for leak detection in CI

## Error Handling
- Prefer returning std::optional or std::expected for fallible operations
- Qt API errors: check return values, don't assume success
- File I/O: check QFile::open() return before reading/writing
- Network: handle all QNetworkReply error states
- Never silently swallow errors — log with qWarning()/qCritical()
```

---

### kotlin-multiplatform.md

Frontmatter (substitute real directory):
```yaml
---
paths:
  - "[detected-kotlin-dir]/**"
  - "**/*.kt"
  - "**/*.kts"
---
```

```markdown
# Kotlin Multiplatform Conventions

## Language
- Kotlin 2.0+ with K2 compiler
- Explicit API mode for library modules
- Coroutines for all async operations

## Code Style
- Formatter: ktlint
- Linter: detekt with compose rules plugin (if Compose is used)
- Naming: camelCase for functions/properties, PascalCase for classes, SCREAMING_SNAKE for constants
- Prefer `val` over `var` — mutability must be justified
- Use data classes for pure data, sealed classes for state hierarchies

## Coroutines
- Structured concurrency: never use `GlobalScope`
- `SupervisorJob` in scopes where child failure should be isolated
- `CoroutineExceptionHandler` at scope boundaries
- Never use `Dispatchers.Main` in `commonMain`
- Always catch `CancellationException` separately or don't catch `Exception` broadly

## Compose (if applicable)
- Stateless composables preferred — hoist state to caller
- All public composables accept a `Modifier` parameter
- Side effects: `LaunchedEffect`, `SideEffect`, `DisposableEffect` only
- Remember: always use `remember` with `mutableStateOf`

## Kotlin Multiplatform
- Maximum logic in `commonMain` — `expect/actual` for platform APIs only
- Keep `actual` implementations thin
- Use `kotlinx-datetime` for dates, `kotlinx-serialization` for JSON
- DI: Koin with `verify()` in tests

## Testing
- Framework: kotlin.test + JUnit5 (JVM) + XCTest bridge (iOS)
- Test shared logic in `commonTest`
- Platform-specific tests only for `actual` implementations
- Test coroutines with `runTest` and `TestDispatcher`

## Error Handling
- Sealed class hierarchies for domain errors
- `Result<T>` for operations that can fail predictably
- Never swallow exceptions silently
- `require()` / `check()` for preconditions
```

---

### CLAUDE.md template

```markdown
# [Project Name]

## Overview
[Fill in: what does this project do?]

## Architecture
[Fill in: high-level architecture description]

## Tech Stack

| Stack | Directory | Purpose |
|---|---|---|
| [detected stacks with actual directories] |

## Key Directories
- `Context/Features/` — Feature specifications, tech plans, and implementation steps
- `Context/Decisions/` — Architecture Decision Records (ADRs)
- `Context/Backlog/` — Ideas and bugs for future work
- `.claude/rules/` — Stack-specific coding conventions

## Development Workflow
This project uses a 4-phase planning workflow:
1. **Spec** — Define what and why (Spec.md with testable assertions)
2. **Tech Research** — Decide how to build (Tech.md with architecture decisions)
3. **Steps** — Break into tasks with tests and docs (Steps.md with milestones)
4. **Implementation** — Build, verify at milestones, commit

Quick tasks skip to a single-file quick plan.

## Conventions
- Conventional commits with task and ADR references
- ADRs required for any deviation from spec
- Milestone checkpoints verify spec alignment
- Test and documentation tasks are planned alongside implementation
- See `.claude/rules/` for stack-specific coding conventions

## Setup
[Fill in: how to install dependencies, build, and run]

## Active Work
- **Feature:** —
- **Status:** Not started
```

---

### Backlog scaffolds

**Ideas.md:**
```markdown
# Ideas Backlog

Ideas and enhancements for future consideration. Add entries via the backlog-add
skill. Prioritize via the backlog-prioritize skill.

<!-- Add new ideas below this line -->
```

**Bugs.md:**
```markdown
# Bugs Backlog

Known bugs not blocking current work. Add entries via the backlog-add skill.
High-priority bugs should be addressed before starting new features.

<!-- Add new bugs below this line -->
```

---

### post-edit-lint.sh template

Generate this with ONLY cases for the detected stacks:

```bash
#!/usr/bin/env bash
# Post-edit linting hook — auto-format on file save.
# Only includes formatters for stacks detected during init.
FILEPATH="$1"
[ -z "$FILEPATH" ] && exit 0
EXTENSION="${FILEPATH##*.}"
case "$EXTENSION" in
    # === Python (if detected) ===
    py)
        command -v ruff &>/dev/null && ruff format "$FILEPATH" 2>/dev/null && ruff check --fix "$FILEPATH" 2>/dev/null
        ;;
    # === Vue/TypeScript (if detected) ===
    vue|ts|tsx|js|jsx)
        command -v npx &>/dev/null && npx prettier --write "$FILEPATH" 2>/dev/null && npx eslint --fix "$FILEPATH" 2>/dev/null
        ;;
    # === Rust (if detected) ===
    rs)
        command -v rustfmt &>/dev/null && rustfmt "$FILEPATH" 2>/dev/null
        ;;
    # === Embedded C/C++ (if detected) / C++/Qt (if detected) ===
    c|h|cpp|hpp)
        command -v clang-format &>/dev/null && clang-format -i "$FILEPATH" 2>/dev/null
        ;;
    # === C++/Qt QML (if detected) ===
    qml)
        command -v qmlformat &>/dev/null && qmlformat -i "$FILEPATH" 2>/dev/null
        ;;
    # === Kotlin (if detected) ===
    kt|kts)
        command -v ktlint &>/dev/null && ktlint -F "$FILEPATH" 2>/dev/null
        ;;
esac
exit 0
```

### settings.json template

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/post-edit-lint.sh $FILEPATH",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

---

### .cortex/config.json

Created during scaffolding if it does not already exist. Stores project-level Cortex configuration.

```json
{
  "issueTracker": {
    "type": "backlog"
  }
}
```
