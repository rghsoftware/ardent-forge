# TypeScript Conventions

## Exhaustive Record Constants

For exhaustive Record constants, use `satisfies Record<K, V>` without an explicit type annotation. This provides compile-time exhaustiveness checking while letting TypeScript infer narrower literal types.

```typescript
// Good
const FOO = { ... } satisfies Record<MyUnion, string>

// Bad -- redundant annotation widens the type
const FOO: Record<MyUnion, string> = { ... } satisfies Record<MyUnion, string>
```

## Domain-Keyed Record Types

All Record types keyed by domain union types (SessionType, BlockType, GroupType, SetSchemeType, etc.) must use the union as the key type, not `string`. Use `satisfies` for exhaustiveness. This ensures new domain variants cause compile errors instead of silent fallbacks.

```typescript
// Good
const STYLES = { ... } satisfies Record<BlockType, string>

// Bad -- new BlockType variants silently fall back
const STYLES: Record<string, string> = { ... }
```
