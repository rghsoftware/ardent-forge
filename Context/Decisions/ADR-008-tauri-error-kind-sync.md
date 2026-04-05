# ADR-008: Synchronize TypeScript TauriAppError Kind Union with Rust ErrorKind

**Status:** Proposed
**Date:** 2026-04-04
**Context:** PR #72 review finding P9-009

## Context

The Rust `ErrorKind` enum (`src-tauri/src/error.rs`) includes variants: `NotFound`, `Conflict`, `Validation`, `Database`, `Internal`, `Unauthorized`, `Sync`, and `Network`.

The TypeScript `TauriAppError['kind']` type (`src/lib/tauri-adapter.ts:476-480`) only lists: `NOT_FOUND | CONFLICT | VALIDATION | DATABASE | INTERNAL`.

If Rust returns `UNAUTHORIZED`, `SYNC`, or `NETWORK`, TypeScript code doing exhaustive switch/case on the kind will miss them. This is pre-existing but was surfaced because PR #72 adds tests exercising the error wrapping path.

## Decision

**To be decided.** Two options:

### Option A: Sync the TypeScript union to match Rust

Add `UNAUTHORIZED | SYNC | NETWORK` to the TypeScript `TauriAppError['kind']` type. Update any switch/case or conditional logic to handle these new kinds.

**Pros:** Full type safety, exhaustive matching, no silent fallthrough.
**Cons:** Requires updating all error-handling callsites.

### Option B: Handle unknown kinds with a fallback

Keep the TypeScript union as-is but add a default/fallback case in error handling that maps unknown kinds to `INTERNAL`.

**Pros:** Minimal change, forward-compatible with future Rust variants.
**Cons:** Loses specificity for `UNAUTHORIZED`/`SYNC`/`NETWORK` errors.

## Consequences

- If Option A: every new Rust `ErrorKind` variant requires a corresponding TypeScript update
- If Option B: new Rust variants are silently treated as INTERNAL until explicitly added
- Either way, the current gap should be documented and tracked
