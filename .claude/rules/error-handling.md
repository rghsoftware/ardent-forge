# Error Handling Conventions

## Error Type Semantics

Error types at system boundaries must distinguish input validation failures from network/transport failures. Use distinct error variants (e.g., `INVALID_INPUT` vs `NETWORK_ERROR`) so callers can branch on error type for retry logic, user messaging, and logging without ambiguity.

## Catch Blocks

Never use bare `catch {}`. Always capture the error parameter and log it with a bracketed module prefix:

```typescript
// Bad
try { ... } catch { return fallback }

// Good
try { ... } catch (err) {
  console.error('[module-name] Description:', err)
  return fallback
}
```

This ensures errors are traceable in the dev console and production logs.

## Adapter Boundary Fallbacks

Safety-net coercions at adapter boundaries (null-to-default, type coercions) should log at warn level when the fallback triggers for fields expected to be non-nullable. Silent coercion hides data integrity issues.

```typescript
// Bad -- silent coercion
function intToBool(val: number | null, fallback = false): boolean {
  return val == null ? fallback : val !== 0
}

// Good -- logs when safety net triggers
function intToBool(val: number | null, field: string, fallback = false): boolean {
  if (val == null) {
    console.warn(`[adapter] ${field}: expected non-null int, using fallback ${fallback}`)
    return fallback
  }
  return val !== 0
}
```

## User-Action Guard Clauses

Guard clauses in user-action handlers (save, delete, submit) must never silently return. Always log with `[module-name]` prefix and set a user-facing error state (e.g., `setErrors()`, toast notification).

```typescript
// Bad
const handleSave = () => {
  if (!userId) return
  // ...
}

// Good
const handleSave = () => {
  if (!userId) {
    console.error('[my-module] Cannot save: no authenticated user')
    setErrors((prev) => ({ ...prev, general: 'You must be signed in to save.' }))
    return
  }
  // ...
}
```
