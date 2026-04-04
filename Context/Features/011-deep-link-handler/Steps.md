# Feature 011: Deep Link Handler -- Implementation Steps

## Team Composition

| Role                | Agent      | Stacks                                      |
| ------------------- | ---------- | ------------------------------------------- |
| Frontend Specialist | `frontend` | React, TypeScript, TanStack Router, Zustand |

Single-agent feature -- all changes are frontend/config, tightly coupled, and must land together.

## Implementation Waves

### Wave 1: Foundation (new modules + config)

These tasks have no dependencies on each other and can execute in parallel.

---

#### S001: Create pending connect transient store

**Agent:** `frontend`
**Files:** `src/lib/pending-connect.ts` (new)
**Depends on:** nothing
**Parallel:** yes (with S002, S003, S004)

Create `src/lib/pending-connect.ts` with a minimal Zustand store:

```typescript
interface PendingConnectState {
  pending: { url: string; key: string } | null
  setPending: (url: string, key: string) => void
  clear: () => void
}
```

Export `usePendingConnect` (the Zustand hook). The store must be accessible outside React via `usePendingConnect.getState()`.

**Done when:** Store exports `usePendingConnect` with `pending`, `setPending`, `clear`.

---

#### S002: Create deep link handler module

**Agent:** `frontend`
**Files:** `src/lib/deep-link-handler.ts` (new)
**Depends on:** S001 (import pending connect store)
**Parallel:** no -- needs S001's export

Create `src/lib/deep-link-handler.ts` with a single exported async function:

```typescript
export async function handleConnectLink(urlStr: string): Promise<void>
```

Logic:

1. Call `parseInviteLink(urlStr)` from `src/lib/invite-link.ts`. If null, `toast('Invalid invite link')` and return.
2. Call `await getConfigStore().hasConfig()`.
3. If no config: `window.location.href = '/setup?url=${encodeURIComponent(parsed.url)}&key=${encodeURIComponent(parsed.key)}'` and return.
4. If config exists: `await getConfigStore().getConfig()` and compare `config.supabaseUrl` with `parsed.url`.
5. Same instance: `toast('Already connected to this server')` and return.
6. Different instance: call `usePendingConnect.getState().setPending(parsed.url, parsed.key)`, then `window.location.href = '/profile'`.

Imports: `parseInviteLink` from `@/lib/invite-link`, `getConfigStore` from `@/lib/config-store`, `usePendingConnect` from `@/lib/pending-connect`, `toast` from `sonner`.

**Done when:** `handleConnectLink` correctly branches for all four cases (invalid, unconfigured, same, different).

---

#### S003: Register `connect` host in Tauri config

**Agent:** `frontend`
**Files:** `src-tauri/tauri.conf.json`
**Depends on:** nothing
**Parallel:** yes (with S001, S004)

Add a second entry to `plugins.deep-link.mobile`:

```json
"deep-link": {
  "mobile": [
    { "schemes": ["ardentforge"], "host": "auth" },
    { "schemes": ["ardentforge"], "host": "connect" }
  ]
}
```

**Done when:** `tauri.conf.json` has both `auth` and `connect` hosts registered.

---

#### S004: Exempt `/connect` from root route guard

**Agent:** `frontend`
**Files:** `src/routes/__root.tsx`
**Depends on:** nothing
**Parallel:** yes (with S001, S002, S003)

Add `location.pathname === '/connect'` to the existing bypass condition in `beforeLoad`:

```typescript
if (
  location.pathname === '/setup' ||
  location.pathname === '/connect' ||
  location.pathname.startsWith('/s/') ||
  location.pathname === '/display'
)
  return
```

**Done when:** Navigating to `/connect` does not redirect to `/setup` regardless of config state.

---

### Wave 2: Integration (wire up existing components)

These tasks depend on Wave 1 outputs and modify existing files.

---

#### S005: Add dispatch branch to `onOpenUrl` listener

**Agent:** `frontend`
**Files:** `src/lib/auth.tsx`
**Depends on:** S002
**Parallel:** yes (with S006, S007, S008)

In the `onOpenUrl` callback (around line 173), add a hostname check before the existing OAuth logic:

```typescript
const url = new URL(urlStr)
if (url.hostname === 'connect') {
  await handleConnectLink(urlStr)
  return
}
```

Add import: `import { handleConnectLink } from '@/lib/deep-link-handler'`

The existing OAuth handling (code exchange, error redirect) remains completely untouched -- the new branch returns early before reaching it.

**Done when:** Deep links with `connect` hostname dispatch to `handleConnectLink`; `auth` hostname links still trigger OAuth exchange.

---

#### S006: Create `/connect` browser route

**Agent:** `frontend`
**Files:** `src/routes/connect.tsx` (new)
**Depends on:** S002, S004
**Parallel:** yes (with S005, S007, S008)

Create a TanStack Router file route at `src/routes/connect.tsx`:

1. `validateSearch`: extract `url` and `key` as optional strings.
2. Component: a minimal component that calls `handleConnectLink` in a `useEffect` on mount. Constructs the full `ardentforge://connect?url=...&key=...` string from search params and passes it to `handleConnectLink`. If either param is missing, show toast and redirect to `/setup`.
3. Renders nothing visible (or a brief loading indicator) since the handler navigates away immediately.

**Done when:** Browser navigation to `/connect?url=X&key=Y` triggers the same three-way branching as the Tauri deep link.

---

#### S007: Setup screen accepts pre-populated search params

**Agent:** `frontend`
**Files:** `src/routes/setup.tsx`
**Depends on:** S002
**Parallel:** yes (with S005, S006, S008)

Two changes to the setup route:

1. **Add `validateSearch`** to the route definition:

   ```typescript
   validateSearch: (search): { url?: string; key?: string } => ({
     url: (search.url as string) || undefined,
     key: (search.key as string) || undefined,
   }),
   ```

2. **Add a `useEffect`** in `SetupPage` that checks for pre-populated values from search params (via `Route.useSearch()`). If both `url` and `key` are present:
   - Set `url` and `key` state
   - Set `advancedOpen` to `true`
   - Call `validateAndSave(search.url, search.key)` to auto-trigger validation

Guard with a ref to prevent double-execution (same pattern as the existing `autoValidated` ref).

**Done when:** Navigating to `/setup?url=X&key=Y` expands the advanced section, pre-populates fields, and auto-validates.

---

#### S008: BackendSettings consumes pending connect store

**Agent:** `frontend`
**Files:** `src/components/profile/backend-settings.tsx`
**Depends on:** S001
**Parallel:** yes (with S005, S006, S007)

Add a `useEffect` in `BackendSettings` that checks the pending connect store on mount:

```typescript
useEffect(() => {
  const { pending, clear } = usePendingConnect.getState()
  if (pending) {
    setEditing(true)
    setUrl(pending.url)
    setKey(pending.key)
    clear()
  }
}, [])
```

When pending values exist, the component opens the editing form pre-populated with the new backend's URL and key. The user reviews and clicks "Connect" to trigger the existing `handleSubmit` flow (validation, Tauri confirmation dialog, backend change).

**Done when:** After a deep link for a different instance, BackendSettings opens with pre-populated fields ready for user confirmation.

---

### Wave 3: Verification

---

#### S009: Route tree regeneration + build verification

**Agent:** `frontend`
**Files:** `src/routeTree.gen.ts` (auto-generated)
**Depends on:** S006
**Parallel:** no

Run `bun run build` to:

1. Trigger TanStack Router codegen (regenerates `routeTree.gen.ts` with the new `/connect` route)
2. Verify TypeScript compilation passes
3. Verify no import errors or type mismatches

**Done when:** `bun run build` succeeds with zero errors.

---

#### S010: Unit tests for deep link handler

**Agent:** `frontend`
**Files:** `src/lib/__tests__/deep-link-handler.test.ts` (new)
**Depends on:** S002
**Parallel:** yes (with S009)

Write tests for `handleConnectLink()`:

| Test case                                | Setup                                | Assertion                                                     |
| ---------------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Invalid link (not ardentforge://connect) | n/a                                  | `toast('Invalid invite link')` called                         |
| Missing params                           | `ardentforge://connect` (no url/key) | `toast('Invalid invite link')` called                         |
| Unconfigured app                         | Mock `hasConfig()` -> false          | `window.location.href` set to `/setup?url=...&key=...`        |
| Configured, same instance                | Mock `getConfig()` -> matching URL   | `toast('Already connected to this server')` called            |
| Configured, different instance           | Mock `getConfig()` -> different URL  | `setPending` called, `window.location.href` set to `/profile` |

Mock `getConfigStore` (return mock object), `toast` (from sonner), and `window.location.href` (use `Object.defineProperty` or jsdom assignment).

**Done when:** All 5 test cases pass via `bun run test`.

---

## Milestone Summary

| Wave | Tasks     | Parallel?                                | Validates                                       |
| ---- | --------- | ---------------------------------------- | ----------------------------------------------- |
| 1    | S001-S004 | S001+S003+S004 parallel, S002 after S001 | New modules exist, config updated               |
| 2    | S005-S008 | All parallel                             | Deep links dispatch correctly, UI pre-populates |
| 3    | S009-S010 | S009+S010 parallel                       | Build passes, tests pass                        |

#### S011: Tests for /connect route and auth.tsx connect dispatch

**Agent:** `frontend`
**Files:** `src/routes/__tests__/connect.test.tsx` (new), `src/lib/__tests__/auth-oauth.test.tsx`
**Depends on:** S006, S005
**Parallel:** no

Add tests for:

1. `/connect` route component: missing-params guard (toasts + redirects to /setup), error catch when `handleConnectLink` rejects (toasts + redirects to /setup), URL reconstruction from search params.
2. `auth.tsx` connect dispatch: verify `url.hostname === 'connect'` routes to `handleConnectLink` instead of OAuth code exchange. Verify non-connect hostnames still go through OAuth flow.

**Done when:** Both the `/connect` route edge cases and the `onOpenUrl` connect dispatch branch have test coverage.

---

## Milestone Summary

| Wave | Tasks     | Parallel?                                | Validates                                       |
| ---- | --------- | ---------------------------------------- | ----------------------------------------------- |
| 1    | S001-S004 | S001+S003+S004 parallel, S002 after S001 | New modules exist, config updated               |
| 2    | S005-S008 | All parallel                             | Deep links dispatch correctly, UI pre-populates |
| 3    | S009-S010 | S009+S010 parallel                       | Build passes, tests pass                        |
| 4    | S011      | Independent                              | Route + dispatch edge cases covered             |

**Total tasks:** 11
**Critical path:** S001 -> S002 -> S005 (Tauri dispatch wired up)
**Estimated effort:** 0.5 days
