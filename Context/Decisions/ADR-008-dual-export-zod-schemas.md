# ADR-008: Dual Export for Zod Schemas with Refinements

## Status

Accepted

## Context

PR #71 added `.refine()` calls to `conversationSchema`, `conversationParticipantSchema`, and `messageSchema` to enforce domain invariants (e.g., direct conversations cannot have a groupId, leftAt must be after joinedAt, system messages cannot have a senderId).

Adding `.refine()` to a `ZodObject` changes its type to `ZodEffects`, which loses access to `.pick()`, `.omit()`, `.extend()`, and `.merge()`. Any consumer deriving a sub-schema (e.g., a create form that picks a subset of fields) will hit a runtime error because those methods do not exist on `ZodEffects`.

This affects all domain schemas in `src/domain/types/` that use refinements.

## Options Considered

### Option A: Only export the refined schema

Keep the current single export. Consumers that need composability must work around it by duplicating the base shape or using `z.object()` from scratch.

**Pros:** Simple, single export per schema.
**Cons:** Breaks `.pick()`, `.omit()`, `.extend()`, `.merge()` for all consumers. Forces duplication when deriving sub-schemas.

### Option B: Dual export (object schema + refined schema)

Export both the raw `ZodObject` (for composability) and the refined `ZodEffects` (for validation). Naming convention: `fooObjectSchema` for the composable base, `fooSchema` for the validated version.

**Pros:** Consumers choose composability or validation as needed. No runtime surprises. The refined schema wraps the object schema, so there is no duplication of field definitions.
**Cons:** Two exports per schema. Consumers must know which to use.

### Option C: Move refinements to standalone assertion functions

Remove `.refine()` from schemas entirely. Export only the `ZodObject` and provide separate `assertConversation(data)` functions that throw on invariant violations.

**Pros:** Full composability preserved. Assertions can be called explicitly at boundaries.
**Cons:** Loses Zod's built-in error formatting and `.safeParse()` integration. Validation is no longer co-located with the schema definition.

## Decision

**Option B: Dual export.**

Convention:

- `export const conversationObjectSchema = syncableEntitySchema.extend({...})`
- `export const conversationSchema = conversationObjectSchema.refine(...)`
- Type inference uses the refined schema: `export type Conversation = z.infer<typeof conversationSchema>`

This keeps validation co-located with the schema, preserves composability for derived schemas, and follows the principle of least surprise -- `fooSchema` always validates, `fooObjectSchema` always composes.

## Consequences

- All domain schemas with refinements (`conversation.ts`, `message.ts`) will export both `*ObjectSchema` and `*Schema`
- Consumers that derive sub-schemas (forms, API payloads) use `*ObjectSchema`
- Consumers that validate data at boundaries use `*Schema`
- New domain schemas should follow this pattern if they add refinements
- Schemas without refinements continue to export a single schema (no dual export needed)
