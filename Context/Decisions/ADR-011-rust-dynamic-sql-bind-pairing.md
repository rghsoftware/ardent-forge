# ADR-011: Paired Clause + Bind Pattern for Dynamic SQL in Rust Commands

**Date:** 2026-04-06
**Status:** Proposed
**Feature:** 017-Program-Time-Travel

## Context

The `update_active_program` Rust command in `src-tauri/src/commands/programs.rs` builds a dynamic SQL UPDATE statement where SET clauses and bind parameters are assembled in separate conditional blocks. Correctness depends on the `if let Some(...)` blocks executing in the exact same order as `set_clauses.push(...)`. Reordering one without the other silently binds wrong values to wrong columns.

This pattern works today because the code is short and the conditionals are adjacent, but it is fragile under maintenance -- a future developer adding a new optional field or reordering the blocks could introduce a silent data corruption bug.

## Decision

Adopt a paired clause-and-bind approach using a vector of tuples so that each SET clause is permanently associated with its bind value. This eliminates the ordering dependency between two separate code paths.

### Current (fragile)

```rust
let mut set_clauses: Vec<String> = Vec::new();
if current_block_ordinal.is_some() {
    set_clauses.push("current_block_ordinal = ?".to_string());
}
// ... later, in the same order ...
if let Some(ref block_ord) = current_block_ordinal {
    query = query.bind(block_ord);
}
```

### Proposed (paired)

Use a helper that pairs each clause with its bind value, ensuring they can never go out of sync. The exact implementation (e.g., `Vec<(&str, Box<dyn sqlx::Encode>)>`, a macro, or a builder struct) should be chosen based on what sqlx ergonomics allow.

## Rationale

- **Safety:** Eliminates an entire class of silent-binding bugs at the source.
- **Maintainability:** Adding a new optional field becomes a single-line addition rather than coordinated changes in two places.
- **Low risk:** This is a refactor of internal command logic with no API or schema changes.

## Consequences

- Requires a refactor of `update_active_program` (and potentially other dynamic-SQL commands if the pattern is adopted broadly).
- Slight increase in code complexity at the binding site, offset by elimination of ordering fragility.
- Should be validated with existing `update_active_program` tests to ensure no behavioral change.
