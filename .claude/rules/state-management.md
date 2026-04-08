# State Management Conventions

## Zustand Store Boundary Validation

Zustand stores that accept domain-constrained values should validate at their own boundary, not rely solely on caller validation. This makes stores self-protecting against future callers that might bypass upstream validation.

```typescript
// Bad: relies on callers to validate
setPending: (url, key) => set({ pending: { url, key } })

// Good: validates at the store boundary
setPending: (url, key) => {
  if (!url.startsWith('https://') || !key) return
  set({ pending: { url, key } })
}
```

## Module-State Setter Validation

The same boundary-validation principle applies to functions in a module that mutate module-scope state -- they are operationally equivalent to a state store. A module-level setter that accepts domain-constrained values should validate at the module boundary, not assume callers got it right.

This matters most for modules with multiple call sites (publishers, subscribers, adapters, registries) where a future caller could quietly bypass upstream validation. Examples in this codebase: `display-publisher.ts::configureDisplayPublisher`, `display-subscriber.ts::initDisplaySubscriber`, `gym-picker-storage.ts::writeLastGymChoice`.

```typescript
// Bad: silently mutates with whatever the caller passed
let _activeGymId: string | null = null
export function configureDisplayPublisher({ gymId }: { gymId: string | null }): void {
  _activeGymId = gymId
  // empty string would silently produce a `display:gym:` channel name
}

// Good: validates at the module boundary
export function configureDisplayPublisher({
  gymId,
  intent,
}: {
  gymId: string | null
  intent: 'broadcasting' | 'private'
}): void {
  if (intent === 'broadcasting' && gymId === null) {
    console.error('[display-publisher] intent=broadcasting requires gymId')
    return
  }
  if (intent === 'private' && gymId !== null) {
    console.error(`[display-publisher] intent=private requires gymId=null, got ${gymId}`)
    return
  }
  _activeGymId = gymId
  _publisherMode = intent
}
```

The validation should always **log** rather than throw silently, so the bypass attempt is observable in production traces.

## Zustand + React Integration

- Access store state in components via the hook: `const value = useMyStore((s) => s.value)`
- Access store state outside React (event handlers, side effects) via `useMyStore.getState()`
- For one-time initialization from a store, use `useState` initializer functions to avoid render-phase side effects:

```typescript
// Bad: setState during render
const pending = usePendingConnect.getState().pending
if (pending) {
  setUrl(pending.url)
} // side effect during render

// Good: initialize via useState
const [url, setUrl] = useState(() => usePendingConnect.getState().pending?.url ?? '')
```
