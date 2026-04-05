# ADR-008: Synchronize TypeScript TauriAppError Kind Union with Rust ErrorKind

**Status:** Accepted
**Date:** 2026-04-04
**Context:** PR #72 review finding P9-009

## Context

The Rust `ErrorKind` enum (`src-tauri/src/error.rs`) includes variants: `NotFound`, `Conflict`, `Validation`, `Database`, `Internal`, `Unauthorized`, `Sync`, and `Network`.

The TypeScript `TauriAppError['kind']` type (`src/lib/tauri-adapter.ts:476-480`) only lists: `NOT_FOUND | CONFLICT | VALIDATION | DATABASE | INTERNAL`.

If Rust returns `UNAUTHORIZED`, `SYNC`, or `NETWORK`, TypeScript code doing exhaustive switch/case on the kind will miss them. This is pre-existing but was surfaced because PR #72 adds tests exercising the error wrapping path.

## Decision

**Option A: Sync the TypeScript union to match Rust.**

Add `UNAUTHORIZED | SYNC | NETWORK` to the TypeScript `TauriAppError['kind']` type.

**Why:**

- `UNAUTHORIZED` and `SYNC` are already used in Rust production code. The frontend will need to distinguish these for auth redirects and retry logic.
- `NETWORK` is declared in Rust (currently `#[allow(dead_code)]`) but Serde will serialize it if constructed. Including it prevents a runtime/type mismatch.
- The `isTauriAppError` type guard only checks `typeof kind === 'string'`, so Rust can already return any variant and pass the guard. The TS union was simply lying about what values were possible.
- Mapping unknown kinds to `INTERNAL` (Option B) hides the error's nature and prevents appropriate handling (e.g., redirecting to login on `UNAUTHORIZED`).
- New Rust `ErrorKind` variants are rare and should cause a compile-time type mismatch in TypeScript, which is the desired failure mode.

**Option B rejected:** Silent fallback to `INTERNAL` actively hides error semantics.

## Consequences

- Every new Rust `ErrorKind` variant requires a corresponding TypeScript update. This is intentional -- loud failures at compile time are better than silent mishandling at runtime.
- No production callers currently switch on `kind`, so no existing code needs changes beyond the type definition.
- Aligns with the project's `typescript-conventions.md` rule: domain-keyed types must use the union, not `string`.
