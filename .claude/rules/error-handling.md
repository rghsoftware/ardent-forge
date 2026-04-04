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
