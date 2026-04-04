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
