---
paths:
  - "src-tauri/**"
  - "**/*.rs"
---

# Rust/Tauri Conventions

## Language
- Rust stable channel, edition 2021
- Minimum rust version: 1.77.2
- Clippy: `cargo clippy -- -D warnings` must pass

## Code Style
- Formatter: rustfmt (default configuration)
- `use` imports: grouped by std -> external crates -> internal modules
- Error types: use `Result<T, String>` for Tauri commands
- Naming: snake_case for functions/variables, PascalCase for types, SCREAMING_SNAKE for constants

## Patterns
- Prefer `?` operator over `unwrap()` in application code
- `unwrap()` acceptable in tests and after explicit validation
- Every `unsafe` block must have a `// SAFETY:` comment explaining the invariant
- Prefer iterators over indexed loops

## Tauri-Specific
- All `#[tauri::command]` handlers must validate inputs before processing
- Capability permissions: least-privilege -- request only what's needed
- IPC: return `Result<T, String>` from commands for proper error propagation
- State: use `tauri::State<>` for shared state, not global statics
- Windows: scope file system access to app directories

## Dependencies
- serde/serde_json for serialization
- SQLx with SQLite for local offline storage
- reqwest (rustls) for HTTP requests
- tokio for async runtime
- chrono for date/time handling
- tauri-plugin-notification for system notifications
- tauri-plugin-deep-link for URL scheme handling

## Async
- Tokio runtime for async operations
- Never block inside async functions
- `JoinHandle` errors must be handled
- Use `tokio::select!` for concurrent operations with cancellation

## Testing
- Unit tests: `#[cfg(test)]` module in each source file
- Integration tests: `tests/` directory at crate root
- Mock external dependencies -- don't hit real APIs in tests
- Dev dependencies: tokio with rt, rt-multi-thread, macros features
