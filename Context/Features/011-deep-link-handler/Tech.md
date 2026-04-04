# Feature 011: Deep Link Handler -- Technical Plan

## Architecture Overview

The deep link handler adds a dispatch layer to the existing `onOpenUrl` listener and a parallel browser route, both funneling into a shared handler function. No new plugins, no Rust changes, no schema changes.

```
                    ┌──────────────────────┐
                    │  OS deep link event   │
                    │  ardentforge://...    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  onOpenUrl listener   │
                    │  (auth.tsx)           │
                    └──────────┬───────────┘
                               │ dispatch on hostname
              ┌────────────────┼────────────────┐
              │                                 │
    ┌─────────▼──────────┐           ┌──────────▼──────────┐
    │  hostname: "auth"  │           │  hostname: "connect" │
    │  (existing OAuth)  │           │  handleConnectLink() │
    └────────────────────┘           └──────────┬──────────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          │                     │                     │
                ┌─────────▼────────┐  ┌─────────▼────────┐ ┌─────────▼────────┐
                │  No config       │  │  Same instance   │ │  Diff instance   │
                │  → /setup?url&key│  │  → toast         │ │  → /profile      │
                └──────────────────┘  └──────────────────┘ │  + pending store  │
                                                           └──────────────────┘

    ┌──────────────────────┐
    │  Browser: /connect   │──── same handleConnectLink() ────► same 3 branches
    └──────────────────────┘
```

## Key Decisions

### D1: Shared handler function vs inline logic

**Decision:** Extract `handleConnectLink(urlStr: string)` into `src/lib/deep-link-handler.ts`.

Both the Tauri `onOpenUrl` callback and the browser `/connect` route need the same three-way branching logic (unconfigured / same instance / different instance). A shared function avoids duplication and is independently testable.

The function uses `parseInviteLink()` from `src/lib/invite-link.ts` (already exists) and `getConfigStore()` for config checks. It returns nothing -- it performs navigation and toasts as side effects, matching the existing pattern in the auth deep link handler.

**Navigation:** Uses `window.location.href` for redirects (same pattern as existing `auth.tsx` deep link handler at line 179). This works because the handler runs outside React's render cycle in Tauri mode, and in the browser `/connect` route it triggers a full page transition which is acceptable for a one-time redirect.

### D2: Transient Zustand store for backend settings pre-population

**Decision:** Create `src/lib/pending-connect.ts` with a minimal Zustand store.

**Why not route search params on `/profile`:** The profile page is a general-purpose authenticated route. Adding `connectUrl` and `connectKey` search params couples it to deep link concerns. The search params would also be visible in the URL bar and browser history, leaking backend credentials into navigation state.

**Why Zustand transient store:** Zustand stores are accessible both inside React (`usePendingConnect()` hook) and outside React (`usePendingConnect.getState().setPending(url, key)`). This lets the Tauri deep link handler (non-React) set the pending values, then the BackendSettings component (React) consumes them on mount. The store is ephemeral -- values are cleared after consumption and lost on page reload, which is the correct behavior.

```typescript
// src/lib/pending-connect.ts
import { create } from 'zustand'

interface PendingConnectState {
  pending: { url: string; key: string } | null
  setPending: (url: string, key: string) => void
  clear: () => void
}

export const usePendingConnect = create<PendingConnectState>((set) => ({
  pending: null,
  setPending: (url, key) => set({ pending: { url, key } }),
  clear: () => set({ pending: null }),
}))
```

### D3: Setup screen pre-population via route search params

**Decision:** Add `url` and `key` search params to the `/setup` route definition.

Unlike `/profile`, the setup route is purpose-built for onboarding. Search params here are semantically correct and don't leak sensitive info (the setup screen already displays these values in form fields). The route's `validateSearch` extracts and sanitizes the params. A `useEffect` in `SetupPage` detects their presence, expands the advanced section, pre-populates the fields, and auto-triggers validation.

### D4: Tauri deep-link config -- add `connect` host

**Decision:** Add a second entry to the `plugins.deep-link.mobile` array in `tauri.conf.json`.

```json
"deep-link": {
  "mobile": [
    { "schemes": ["ardentforge"], "host": "auth" },
    { "schemes": ["ardentforge"], "host": "connect" }
  ]
}
```

This registers `ardentforge://connect` as a handled URL scheme on Android. The Android manifest (`gen/android/`) is auto-regenerated by Tauri on the next build. No manual manifest editing needed.

### D5: Root route guard exemption for `/connect`

**Decision:** Add `/connect` to the allowlist in `__root.tsx` `beforeLoad`.

The root route guard redirects to `/setup` when no config exists. The `/connect` route must be reachable regardless of config state (it handles the "unconfigured" case itself). Adding `location.pathname === '/connect'` to the existing bypass condition is a one-line change.

### D6: Dispatch strategy in `onOpenUrl`

**Decision:** Add a hostname check at the top of the existing `onOpenUrl` callback in `auth.tsx`.

```typescript
const url = new URL(urlStr)
if (url.hostname === 'connect') {
  await handleConnectLink(urlStr)
  return
}
// ... existing OAuth handling continues unchanged
```

This is the minimal change -- a single early return branch. The existing OAuth code is untouched, eliminating regression risk.

## Stack-Specific Details

### Frontend (React/TypeScript)

**New files:**
| File | Purpose |
|------|---------|
| `src/lib/deep-link-handler.ts` | `handleConnectLink()` -- shared handler for connect deep links |
| `src/lib/pending-connect.ts` | Zustand transient store for pending backend change values |
| `src/routes/connect.tsx` | TanStack Router `/connect` route (browser fallback) |

**Modified files:**
| File | Change |
|------|--------|
| `src/lib/auth.tsx` | Add dispatch branch in `onOpenUrl` callback (~3 lines) |
| `src/routes/__root.tsx` | Add `/connect` to guard allowlist (~1 line) |
| `src/routes/setup.tsx` | Add search param validation + auto-populate effect (~15 lines) |
| `src/components/profile/backend-settings.tsx` | Consume pending connect store on mount (~10 lines) |

### Tauri (Config only)

**Modified files:**
| File | Change |
|------|--------|
| `src-tauri/tauri.conf.json` | Add `connect` host to deep-link plugin config |

No Rust code changes. No new plugins. Android manifest regenerated automatically.

## Integration Points

1. **`parseInviteLink()` (invite-link.ts):** Already handles `ardentforge://connect?url=...&key=...` parsing. Reused as-is by `handleConnectLink()`.

2. **`getConfigStore()` (config-store.ts):** Used by `handleConnectLink()` to check current config state. All methods are async (Promise-based), which the handler already accounts for.

3. **`validateAndSave()` (setup.tsx):** The setup screen's existing save pipeline. Pre-populated search params trigger this via the auto-validate `useEffect`, not by calling it directly from the handler.

4. **`BackendSettings` (backend-settings.tsx):** The existing `editing` state and `url`/`key` form fields are pre-populated from the pending connect store. The existing `handleSubmit` flow (validate, confirm dialog on Tauri, apply change) runs unchanged.

5. **`toast()` (sonner):** Standalone function, callable outside React. Used by `handleConnectLink()` for "Already connected" and "Invalid invite link" messages.

## Risks and Mitigations

| Risk                                                         | Impact | Mitigation                                                                                                                                      |
| ------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `onOpenUrl` dispatch breaks OAuth flow                       | High   | Early return only on `hostname === 'connect'`; all other URLs fall through to existing handler unchanged                                        |
| Android manifest not regenerated                             | Medium | Verify `gen/android/` after `tauri.conf.json` change; if stale, `bun tauri android init` regenerates                                            |
| Setup `beforeLoad` guard conflicts with pre-populated params | Medium | Search params pass through redirect -- if config exists, root guard redirects to `/`, which is correct (configured users shouldn't reach setup) |
| Pending connect store consumed before BackendSettings mounts | Low    | The store is set synchronously before navigation; React render picks it up on mount. `clear()` called only after consuming values               |
| `window.location.href` loses React state                     | Low    | Acceptable for one-time deep link redirect. Matches existing auth handler pattern. New page load bootstraps fresh state                         |

## Testing Strategy

**Unit tests (Vitest):**

- `handleConnectLink()`: mock `getConfigStore()` and assert navigation + toast behavior for all three branches + invalid input
- `parseInviteLink()`: already tested; no changes needed

**Manual testing:**

- Android: `adb shell am start -a android.intent.action.VIEW -d "ardentforge://connect?url=...&key=..."` to simulate deep link
- Browser: navigate to `/connect?url=...&key=...` directly
- Verify OAuth deep links still work after dispatch change

## ADR

### ADR-007: Transient Zustand store for cross-route deep link state

See `Context/Decisions/ADR-007-transient-store-deep-link-state.md`.
