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

## Mutation Hook Error Handling

All `useMutation`-based hooks must attach an `onError` handler that logs with a bracketed `[module-name]` prefix and includes enough context (operation name, key entity ids) to diagnose the failure from logs alone. Where the mutation performs an optimistic cache update, `onError` must also roll the cache back to the snapshotted previous state.

```typescript
// Bad -- silent mutation failure
export function useDeleteWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adapter.deleteWidget(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['widgets'] }),
  })
}

// Good -- prefixed log + cache rollback
export function useDeleteWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adapter.deleteWidget(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['widgets'] })
      const previous = qc.getQueryData(['widgets'])
      qc.setQueryData(['widgets'], (old: Widget[] = []) => old.filter((w) => w.id !== id))
      return { previous }
    },
    onError: (err, id, ctx) => {
      console.error('[widgets] deleteWidget failed:', { id, err })
      if (ctx?.previous) qc.setQueryData(['widgets'], ctx.previous)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['widgets'] }),
  })
}
```

A mutation hook that lacks `onError` is a silent failure: the user-facing component cannot distinguish "request still in flight" from "request failed and the optimistic UI is now lying". The `[module-name]` prefix makes the failure greppable in production logs.

## Query Hook Error States

All `useQuery`-based hooks in user-facing components must destructure and handle `isError` (or `error`). Showing stale or empty UI on a fetch failure is a silent failure. At minimum, render an error state so the user knows something went wrong.

```typescript
// Bad -- ignores error state
const { data, isLoading } = useMyQuery(id)

// Good -- handles error state
const { data, isLoading, isError } = useMyQuery(id)

// ... later in JSX:
// {isError ? <ErrorMessage /> : isLoading ? <Skeleton /> : <Content data={data} />}
```

## Mutation Hook Log Ownership

When a `useMutation` hook has an `onError` handler that logs the failure, the consuming
component must not also catch and log the same rejection. The hook is the single log
owner for that mutation -- a single failure producing two log lines with different module
prefixes is misleading and harder to trace in production.

```typescript
// Bad -- hook logs and component also logs the same rejection
export function useCreateFoo() {
  return useMutation({
    mutationFn: createFoo,
    onError: (err) => console.error('[foos] createFoo failed:', err),
  })
}

// Component:
const handleSubmit = async () => {
  try {
    await createFoo.mutateAsync(values)
  } catch (err) {
    console.error('[foo-form] Failed to create:', err) // duplicate log -- BAD
  }
}

// Good -- hook owns the log; component may still render isError state
export function useCreateFoo() {
  return useMutation({
    mutationFn: createFoo,
    onError: (err) => console.error('[foos] createFoo failed:', err),
  })
}

// Component:
const handleSubmit = async () => {
  try {
    await createFoo.mutateAsync(values)
  } catch {
    // Hook already logged. Component renders error state via createFoo.isError.
  }
}
```

Exception: if the consuming component invokes the mutation via a callback that may
itself throw after the mutation resolves (e.g., an `onCreated` prop), wrap that
callback in its own distinct `try/catch` with a clearly different `[module-name]`
prefix -- that is a separate error domain from the mutation itself.
