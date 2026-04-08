# Tech Plan: Display Setup UX (F019)

**Status:** Draft
**Spec:** [Spec.md](./Spec.md)
**Created:** 2026-04-07

---

## Architecture Overview

F019 is a purely additive UX feature layered on top of the F018 gym-scoped display primitives. It adds:

1. **One new inline component** rendered per `MyGymRow` in the profile gym list (`ShowDisplayPanel`).
2. **One replaced route file** (`src/routes/display/index.tsx`) that delegates to a new dispatcher component.
3. **Three new component files** for the dispatcher sub-views: `DisplayDispatcher`, `DisplayChooser`, `DisplaySetupPanel`.
4. **Two new pure-function modules** for URL parsing and name derivation: `src/lib/display-url.ts`, `src/lib/display-setup.ts`.
5. **Two small shared helpers** extracted for reuse: `src/lib/gym-error-messages.ts` (pulled out of `gym-management-section.tsx`) and `src/hooks/use-qr-scanner.ts` (extracted from `setup.tsx`).
6. **One small backend extension**: `api/discovery.ts` (the Vercel serverless discovery endpoint) returns an additional `app_url` field derived from the request host. `src/lib/config-store.ts`'s `backendConfigSchema` gains an optional `appUrl` field, persisted at setup time.

The feature introduces **zero** database migrations, **zero** changes to F018 publisher/subscriber/idle/channel primitives, **zero** changes to the dumb-TV route (`/display/gym/$gymId`), and **zero** new domain types. The config-store extension is a single optional field that is backward-compatible with existing persisted configs (Zod `.optional()` handles the absent-field case). Every other backend touchpoint routes through hooks that already exist (`useGyms`, `useCreateGym`, `useUserProfile`, `useAuth`).

```
┌──────────────────────────────────────────────────────────────────────┐
│ PROFILE PAGE  (src/routes/_authenticated/profile.tsx — unchanged)    │
│                                                                      │
│  GYMS  › MyGymsList  › MyGymRow                                      │
│                        ├─ Leave / Delete (existing)                  │
│                        └─ [Show display] ◄── NEW button              │
│                                └─ ShowDisplayPanel (NEW)             │
│                                    ├─ URL text                       │
│                                    ├─ Copy button                    │
│                                    ├─ QR code (QRCodeSVG)            │
│                                    └─ Dev-origin warning (conditional)│
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ /display ROUTE  (src/routes/display/index.tsx — REPLACED)            │
│                                                                      │
│     DisplayDispatcher (NEW)                                          │
│       ├─ not authenticated  → LegacyNotConfiguredPage (preserved)    │
│       ├─ loading             → skeleton                              │
│       ├─ error               → error + Retry                         │
│       ├─ 0 gyms              → DisplaySetupPanel (NEW)               │
│       │                         ├─ Panel A: URL input + Tauri QR    │
│       │                         └─ Panel B: Personal display CTA    │
│       ├─ 1 gym               → <Navigate replace />                  │
│       └─ 2+ gyms             → DisplayChooser (NEW)                  │
│                                  ├─ one row per membership (Link)    │
│                                  └─ "Start a personal display" row   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ /display/gym/$gymId ROUTE  (UNCHANGED — F018 contract)              │
│   Boots with publishable key, opens `display:gym:{id}` channel, etc. │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Key Decisions

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Alternatives Considered                                                                                                                                                                                                                                                                                                                                                                          | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Dispatcher logic lives in a component, not a route-level loader.** `src/routes/display/index.tsx` becomes a thin 10-line wrapper that creates the route and renders `<DisplayDispatcher />`. The dispatcher owns all branching.                                                                                                                                                                                                                                                                                                                                                                             | (a) TanStack Router `beforeLoad` + `loader` to redirect server-side; (b) all branching inline in the route file; (c) dispatcher as a custom hook + dumb route.                                                                                                                                                                                                                                   | The gym list is authenticated query data that's cached by TanStack Query, not route-loader data. Moving it into `beforeLoad` would duplicate the cache and fight the existing fetch strategy. A component is straightforwardly unit-testable in isolation with mocked hooks. Keeps the route file thin enough to stay out of test harness setup.                                                                                                                       |
| D2  | **URL parser lives in `src/lib/display-url.ts`** as a pure, React-free module exporting `parseDisplayUrlInput`, `buildDisplayUrl`, and `isDevOrigin`.                                                                                                                                                                                                                                                                                                                                                                                                                                                         | (a) colocate with `src/lib/gym-channel.ts` (F018 module); (b) place inside the component file; (c) split into three tiny files.                                                                                                                                                                                                                                                                  | `gym-channel.ts` is about broadcast channel naming — an infrastructure concern — whereas `display-url.ts` is about the user-facing URL format. Different abstraction layers, different review audiences, keep them separate. One file is the right size; three would be over-fragmentation.                                                                                                                                                                            |
| D3  | **Parser accepts three input shapes** and normalizes to a gym UUID: `https://any-origin/display/gym/{uuid}`, `/display/gym/{uuid}` (path-only), and bare `{uuid}`. Cross-origin URLs are accepted.                                                                                                                                                                                                                                                                                                                                                                                                            | (a) Reject cross-origin URLs for safety; (b) only accept bare UUIDs to force users through the QR/copy path; (c) accept any URL containing a UUID-looking substring.                                                                                                                                                                                                                             | Cross-origin is the common case (Tauri user pastes a URL the web user shared). The dispatcher re-assembles the URL on the _current_ origin, so the user lands somewhere reachable for _their_ client. Option (c) is too permissive and risks matching query-string UUIDs. Zod strictly validates the extracted UUID either way.                                                                                                                                        |
| D4  | **Parser return shape:** `{ ok: true; gymId: string } \| { ok: false; reason: 'malformed' \| 'not-a-uuid' \| 'empty' }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | (a) Throw exceptions; (b) return `string \| null`; (c) return a Zod `SafeParseReturnType`.                                                                                                                                                                                                                                                                                                       | Discriminated union is the idiomatic TS pattern; error-carrying sum types let the UI render specific messages per reason without stringly-typed inspection. Throws would require try/catch at every call site.                                                                                                                                                                                                                                                         |
| D5  | **Personal-gym name derivation** lives in `src/lib/display-setup.ts` as `derivePersonalGymName(displayName: string \| null \| undefined): string`. Clamps `displayName` to 48 chars, suffixes `` ` 's Training` ``, falls back to `"My Training"` on empty.                                                                                                                                                                                                                                                                                                                                                   | (a) Inline in the component; (b) use profile email local-part as fallback; (c) use a hardcoded "Personal display" label.                                                                                                                                                                                                                                                                         | Pure helper is trivial to unit-test, and the 48-char clamp is a load-bearing constraint (60-char `gyms.name` limit minus the fixed suffix). Email local-part leaks identity; "Personal display" is not a valid gym list entry — it's ambiguous when the user creates more than one (though they shouldn't).                                                                                                                                                            |
| D6  | **Public app origin comes from the existing discovery flow, not a new build-time env var.** The Vercel `api/discovery.ts` endpoint is extended to return `app_url` derived from `req.headers.host`. `backendConfigSchema` gains an optional `appUrl` field. `setup.tsx` persists it at setup time via the normal discovery path. At render time, `ShowDisplayPanel` reads the current config for the origin: web → `window.location.origin` (user is already browsing from the right URL); Tauri → `config.appUrl` (persisted at setup). Missing values are handled by D22.                                   | (a) Build-time `VITE_PUBLIC_APP_URL` env var (initial proposal — rejected because it requires a rebuild per environment and doesn't generalize to self-hosted friends-and-family instances); (b) Hardcode a production domain (same rebuild problem); (c) Derive from Supabase URL hostname (unrelated domains, doesn't work).                                                                   | The information is already in the user's hands — they typed the server URL at setup. Throwing it away after discovery and asking for it back at build time is the over-engineered path. `req.headers.host` is self-describing on both Vercel (production `Host` header) and self-hosted docker-compose (the `SITE_URL`-backed Caddy proxy's `Host`). One code change, works for every deployment model, respects the user's mental model of "there is one server URL". |
| D7  | **Dispatcher state machine** is a pure function `computeDispatcherState(auth, gymsQuery): DispatcherState` where `DispatcherState` is a 6-variant union: `unauthenticated`, `loading`, `error`, `zero`, `single(gymId)`, `many(gyms)`. Unit-testable with mocked inputs.                                                                                                                                                                                                                                                                                                                                      | (a) Branch inline in JSX; (b) use a reducer; (c) use a Zustand store.                                                                                                                                                                                                                                                                                                                            | A pure reducer-style function with a discriminated union is easier to exhaust-check with TypeScript than nested ternaries, and eliminates render-phase side effects. No state is mutated, so a reducer or store is unnecessary overhead.                                                                                                                                                                                                                               |
| D8  | **1-gym redirect uses TanStack Router `<Navigate to="/display/gym/$gymId" params={{ gymId }} replace />`** inside the rendered output, not an imperative `useNavigate().navigate()` in a `useEffect`.                                                                                                                                                                                                                                                                                                                                                                                                         | (a) `useEffect(() => navigate(...), [])`; (b) `router.history.replace()`; (c) server-side redirect via `beforeLoad`.                                                                                                                                                                                                                                                                             | Declarative `<Navigate>` integrates with React 19's concurrent rendering and doesn't flash the dispatcher shell before navigating. `useEffect` + `navigate` produces a one-frame flash and is brittle under suspense. Server-side redirect collides with the TanStack Query cache strategy (D1).                                                                                                                                                                       |
| D9  | **Personal-display creation uses `useNavigate()` inside `createGym.mutate`'s `onSuccess`** callback because the new gym ID is not known at render time, so `<Navigate>` cannot be used.                                                                                                                                                                                                                                                                                                                                                                                                                       | (a) Optimistic navigate before the mutation resolves; (b) query `['gyms', 'list', userId]` to find the newest gym.                                                                                                                                                                                                                                                                               | The mutation returns the created `Gym` directly (see `supabase-adapter.createGym` → `Promise<Gym>`), so `onSuccess` receives the ID for free. Optimistic navigate would strand users on a 404 if the insert fails. Querying the list introduces a race with invalidation.                                                                                                                                                                                              |
| D10 | **Extract `gymErrorMessage` from `gym-management-section.tsx` into `src/lib/gym-error-messages.ts`.** Re-export from the section for backward compatibility.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | (a) Copy/paste into the dispatcher; (b) leave inline and import from a component file; (c) push into every mutation hook.                                                                                                                                                                                                                                                                        | A pure function should not live in a component file; importing from a component file for reuse is a smell. Extracting also makes the helper unit-testable without rendering the section. The re-export preserves the existing import path for the section's own use.                                                                                                                                                                                                   |
| D11 | **Copy-to-clipboard helper:** a small wrapper `copyToClipboard(text: string, successMessage: string, failureMessage: string): Promise<void>` in `src/lib/copy-to-clipboard.ts` that handles the try/catch/log/toast pattern used in 4 existing places (`backend-settings.tsx` ×2, `share-dialog.tsx`, `invite-code-display.tsx`).                                                                                                                                                                                                                                                                             | (a) Build a `<CopyButton>` component; (b) keep inline in each call site; (c) use a shared hook `useCopyToClipboard()`.                                                                                                                                                                                                                                                                           | A helper function is the minimal abstraction for the actual repetition (try/catch + toast). A full component would also have to own variant/size/label semantics and lock in a button shape — too prescriptive for 4 diverging call sites. A hook is overkill for a stateless operation. Existing call sites can migrate opportunistically.                                                                                                                            |
| D12 | **QR scanner hook extraction:** extract `useQrScanner()` into `src/hooks/use-qr-scanner.ts` sharing the permission/scanner lifecycle from `setup.tsx` lines 163-209. Called by Panel A's scan button.                                                                                                                                                                                                                                                                                                                                                                                                         | (a) Copy/paste the scanner code; (b) leave scanner logic in the component; (c) build a `<QrScanButton>` component.                                                                                                                                                                                                                                                                               | Extraction is earned: this will be the second call site for the same ~50-line Tauri permission/scan lifecycle. A hook keeps the imperative API (open/cancel/result) while encapsulating the state and cleanup. A component would over-constrain the UI shape.                                                                                                                                                                                                          |
| D13 | **Single-row-open behavior for `ShowDisplayPanel`** (Spec S1): `MyGymsList` owns `useState<string \| null>(null)` for the currently-open row ID. Tapping "Show display" on row A sets the state to A, closes any other open row. Toggle: tapping row A again sets to null.                                                                                                                                                                                                                                                                                                                                    | (a) Per-row local state with independent open/close; (b) a single Zustand slice for dispatcher open state.                                                                                                                                                                                                                                                                                       | Lift-state-up is the idiomatic React 19 pattern for "only one of N children may be in state X". Per-row state breaks the single-open invariant; Zustand is overkill for component-local UI.                                                                                                                                                                                                                                                                            |
| D14 | **Dispatcher file layout:** `src/routes/display/index.tsx` (thin route wrapper) renders `<DisplayDispatcher />` from `src/components/display/display-dispatcher.tsx`. The dispatcher renders one of `<DisplaySetupPanel />`, `<DisplayChooser />`, `<Navigate />`, or the preserved `<LegacyNotConfiguredPage />` inline component based on `computeDispatcherState`.                                                                                                                                                                                                                                         | (a) All sub-views inline in the dispatcher; (b) sub-views as separate route children.                                                                                                                                                                                                                                                                                                            | Separate files for setup panel and chooser keeps each testing surface small. Route-children would require URL changes (e.g., `/display/setup`) which contradicts RD-2. Legacy page is small enough (≤15 lines) to stay inline in the dispatcher file.                                                                                                                                                                                                                  |
| D15 | **No new ADR authored in this feature.** The contract at `/display` (dispatcher vs legacy page) is novel but is a UI dispatch concern, not an architectural one. The discovery endpoint extension (D6) is a narrow additive change to an existing endpoint, not a new architectural boundary. Revisit if either surface grows teeth (e.g., multi-origin support, display authentication).                                                                                                                                                                                                                     | (a) Author ADR-014 "Display Dispatcher Contract"; (b) author ADR-014 "Discovery Endpoint Extension for App URL".                                                                                                                                                                                                                                                                                 | ADRs should capture load-bearing architectural commitments. The dispatcher is a local UX choice revertable in one file. The discovery extension is a single additional JSON field with a clear derivation rule (`req.headers.host`) — adequately captured in Tech.md D6 + D21 without a formal record.                                                                                                                                                                 |
| D16 | **Feature flag:** None. Direct ship behind an open PR that merges to `develop`. Spec.md RD-12/RD-13 explicitly scope the feature to the profile + dispatcher layer, and every change is revertable via a single `git revert` of the merge commit.                                                                                                                                                                                                                                                                                                                                                             | (a) localStorage feature flag gated on `VITE_F019_ENABLED`; (b) partial rollout via URL param.                                                                                                                                                                                                                                                                                                   | No audience to stage against at friends-and-family scale. Flag would add boilerplate to every touched component without a use case. Revertability is already trivial.                                                                                                                                                                                                                                                                                                  |
| D17 | **Dispatcher test harness:** pure-function tests for `computeDispatcherState` + `parseDisplayUrlInput` + `derivePersonalGymName`. Component tests for each branch of `DisplayDispatcher` with mocked `useAuth`/`useGyms`/`useCreateGym`/`useNavigate`. One integration test per major user story (TA5, TA6, TA8, TA13) using a real `<RouterProvider>` and a mocked adapter.                                                                                                                                                                                                                                  | (a) All component tests, no pure-function extraction; (b) E2E only via Playwright.                                                                                                                                                                                                                                                                                                               | Pure-function tests are free and bulletproof; component tests cover the integration seam; the existing Vitest + Testing Library + happy-dom stack is sufficient. Playwright E2E is reserved for cross-stack flows and would be overkill here.                                                                                                                                                                                                                          |
| D18 | **`ShowDisplayPanel` component boundary:** one file, `src/components/profile/show-display-panel.tsx`, takes `{ gym: Gym; isOpen: boolean; onToggle: () => void }`. No data fetching, no store access — pure presentational.                                                                                                                                                                                                                                                                                                                                                                                   | (a) Fuse into `MyGymRow`; (b) split URL+copy and QR into two sub-components.                                                                                                                                                                                                                                                                                                                     | Single-file extraction is the right size for review. `MyGymRow` stays focused on list-row semantics; the panel stays focused on URL-reveal semantics. Further splitting is premature.                                                                                                                                                                                                                                                                                  |
| D19 | **Panel A input auto-focus on setup-panel mount** via `useRef<HTMLInputElement>` + `useEffect(() => ref.current?.focus(), [])`. No `autoFocus` prop (which has accessibility and SSR quirks with React 19).                                                                                                                                                                                                                                                                                                                                                                                                   | (a) `autoFocus={true}`; (b) skip auto-focus entirely; (c) focus only when a heuristic says "keyboard user".                                                                                                                                                                                                                                                                                      | Manual `ref.focus()` in an effect is the recommended React 19 pattern for conditional focus. Paste users benefit; screen-reader users can navigate normally because the focus is on a properly labeled input.                                                                                                                                                                                                                                                          |
| D20 | **Personal-display creation error surfacing:** on `createGym` failure, Panel B renders the error via the extracted `gymErrorMessage(err, 'create')` helper in a `role="alert"` paragraph directly below the CTA button. No toast, no navigate. The button returns to its idle label and stays clickable for retry.                                                                                                                                                                                                                                                                                            | (a) Toast only; (b) navigate to a dedicated error page; (c) silently disable the button.                                                                                                                                                                                                                                                                                                         | Inline error matches the `CreateGymForm` precedent in the same codebase. `role="alert"` announces the failure to screen readers. Toast alone risks being dismissed before the user reads it. Silent disable violates `.claude/rules/error-handling.md`.                                                                                                                                                                                                                |
| D21 | **Discovery endpoint extension mechanics.** `api/discovery.ts` adds `app_url: computeAppUrl(req)` to the JSON response. `computeAppUrl` derives the value from `req.headers['x-forwarded-proto']` (default `https`) + `req.headers.host`, matching the convention Vercel uses in its own edge proxies. `backendConfigSchema` adds `appUrl: z.string().url().optional()`. `setup.tsx`'s discovery callback persists `appUrl` alongside `supabaseUrl` + `supabaseKey`. Existing stored configs that lack `appUrl` remain valid (Zod `.optional`) and fall into the D22 backfill path.                           | (a) Return `process.env.VERCEL_URL` (missing protocol, inconsistent between preview and prod); (b) Require an ops-set env var like `VITE_PUBLIC_APP_URL` on the server side (back to the rejected build-time approach); (c) Have the client infer the host from the URL it used to fetch discovery (client already has it, but persisting it client-side without server confirmation is flimsy). | `req.headers.host` is the canonical self-describing value for "what URL did the client just call?" It works uniformly on Vercel (production `Host`), on self-hosted docker-compose via Caddy (forwards `Host`), and in local dev (`localhost:8080`). `x-forwarded-proto` handles the TLS termination case. No ops config required beyond what already exists.                                                                                                          |
| D22 | **Missing `appUrl` backfill / Advanced-mode users.** When `ShowDisplayPanel` renders on Tauri with `config.appUrl === null` (pre-discovery config, or Advanced-mode setup that bypassed discovery), the panel replaces the URL + Copy + QR with a small inline form: one text input labeled "Server URL", a Save button, and a tertiary "What is this?" affordance. On Save, the panel calls `fetch(\`${input}/api/discovery\`)`, validates the response, persists the returned `app_url`via`setConfig`, invalidates the local React cache, and re-renders. Success path is identical to any other rendering. | (a) Prompt via a modal; (b) force the user back to `/setup`; (c) silently show "not configured" with no repair path.                                                                                                                                                                                                                                                                             | Inline form keeps the user in context — they are looking at a gym row, they get an inline repair step. Forcing a full setup re-run is a regression (would log them out). Silent "not configured" violates `.claude/rules/error-handling.md`. The form is small (30 LOC) and only reaches the render path for a narrow user segment (Advanced-mode Tauri users), so the cost is bounded.                                                                                |

---

## File Structure

### New files

```
src/
├── lib/
│   ├── display-url.ts                       (NEW — parser, builder, dev-origin detect)
│   ├── display-setup.ts                     (NEW — derivePersonalGymName)
│   ├── gym-error-messages.ts                (NEW — extracted from gym-management-section.tsx)
│   ├── copy-to-clipboard.ts                 (NEW — shared helper)
│   └── __tests__/
│       ├── display-url.test.ts              (NEW — unit tests for parser)
│       ├── display-setup.test.ts            (NEW — unit tests for name derivation)
│       ├── gym-error-messages.test.ts       (NEW — unit tests for helper)
│       └── copy-to-clipboard.test.ts        (NEW — clipboard spy tests)
│
├── hooks/
│   ├── use-qr-scanner.ts                    (NEW — extracted from setup.tsx)
│   └── __tests__/
│       └── use-qr-scanner.test.tsx          (NEW — hook tests with mocked Tauri plugin)
│
├── components/
│   ├── profile/
│   │   ├── show-display-panel.tsx           (NEW — inline panel under MyGymRow)
│   │   └── __tests__/
│   │       └── show-display-panel.test.tsx  (NEW)
│   │
│   └── display/
│       ├── display-dispatcher.tsx           (NEW — state machine + branching)
│       ├── display-chooser.tsx              (NEW — 2+-gym full-page chooser)
│       ├── display-setup-panel.tsx          (NEW — 0-gym Panel A + Panel B)
│       └── __tests__/
│           ├── display-dispatcher.test.tsx  (NEW — all 6 states)
│           ├── display-chooser.test.tsx     (NEW)
│           └── display-setup-panel.test.tsx (NEW)
│
└── routes/
    └── display/
        └── index.tsx                         (REPLACED — thin route wrapper)
```

### Modified files

| File                                                                     | Change                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/discovery.ts`                                                       | Add `app_url` field to the JSON response. Derived from `req.headers['x-forwarded-proto']` + `req.headers.host` (D21). Shape becomes `{ version, supabase_url, supabase_publishable_key, app_url }`. Existing clients that do not read `app_url` are unaffected (additive field).                        |
| `src/lib/config-store.ts`                                                | Add `appUrl: z.string().url().optional()` to `backendConfigSchema`. Zod `.optional` keeps pre-existing persisted configs valid. `BackendConfig` type gains the field automatically.                                                                                                                     |
| `src/lib/discovery.ts` (if present) or discovery callback in `setup.tsx` | Parse the new `app_url` field from the discovery response (Zod schema extension) and thread it into the `setConfig` call. When `app_url` is absent from an older-deployment response, log a single warn and proceed without it — the user falls into the D22 backfill path on first Show-display click. |
| `src/routes/display/index.tsx`                                           | Replace static page with `createFileRoute('/display/')({ component: DisplayDispatcherRoute })` where `DisplayDispatcherRoute` renders `<DisplayDispatcher />`.                                                                                                                                          |
| `src/components/profile/gym-management-section.tsx`                      | `MyGymsList` gains `useState<string \| null>` for the open-row ID. `MyGymRow` gets a new `isExpanded` prop and `onToggle` callback. Imports `gymErrorMessage` from the new module. The "Show display" button and `ShowDisplayPanel` render conditionally.                                               |
| `src/routes/setup.tsx`                                                   | Refactor to consume the extracted `useQrScanner()` hook instead of inlining the scanner lifecycle. Persist `app_url` from the discovery response when available. Behavior unchanged for users.                                                                                                          |

### Unchanged (intentionally)

| File                                        | Reason                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/routes/display/gym/$gymId.tsx`         | F018 TV contract — **zero line changes** (Spec.md TA18)                                       |
| `src/lib/display-publisher.ts`              | F018 primitive                                                                                |
| `src/lib/display-subscriber.ts`             | F018 primitive                                                                                |
| `src/lib/gym-channel.ts`                    | F018 primitive                                                                                |
| `src/hooks/use-gyms.ts`                     | Fully reusable as-is                                                                          |
| `src/hooks/use-user-profile.ts`             | Fully reusable as-is                                                                          |
| `src/lib/supabase-adapter.ts` (gym methods) | `createGym` already returns the new `Gym` with `id` populated (`supabase-adapter.ts:569-572`) |
| `supabase/migrations/*`                     | **Zero new migrations** (Spec.md TA19)                                                        |
| `src/components/layout/nav-constants.ts`    | `/display` nav entry and `SKIP_DISCOVERY_ROUTES` already set in d942080                       |
| `src/domain/types/gym.ts`                   | Personal gym is a regular `Gym` — no new fields                                               |

---

## Module Contracts

### `src/lib/display-url.ts`

```typescript
import { z } from 'zod'

// Strict UUID v4 accepted; matches the existing validation in
// src/routes/display/gym/$gymId.tsx line 39.
const uuidSchema = z.string().uuid()

export type ParseResult =
  | { ok: true; gymId: string }
  | { ok: false; reason: 'empty' | 'malformed' | 'not-a-uuid' }

/**
 * Normalizes a user-provided string into a gym UUID. Accepts:
 *  • `https://any-origin/display/gym/{uuid}`
 *  • `/display/gym/{uuid}`
 *  • bare `{uuid}`
 *
 * Trims whitespace. Rejects query strings and fragments. Zod-validates
 * the extracted UUID so malformed input produces a `not-a-uuid` reason
 * rather than navigating to a broken route.
 */
export function parseDisplayUrlInput(raw: string): ParseResult

/**
 * Builds a canonical display URL for a given gym ID. The `origin`
 * argument is passed in by the caller (not read from a global) so the
 * function stays pure and unit-testable.
 *
 * Returns `null` when `origin` is null — callers (ShowDisplayPanel)
 * then render the D22 backfill form instead of a URL.
 *
 * Callers resolve origin as follows:
 *   - Web:   `window.location.origin`
 *   - Tauri: `config.appUrl` from the persisted BackendConfig (D6)
 */
export function buildDisplayUrl(gymId: string, origin: string | null): string | null

/**
 * True when an origin string looks like a development loopback URL
 * (`localhost`, `127.0.0.1`, `[::1]`). Used for the dev-origin warning
 * caption in `ShowDisplayPanel` (Spec.md M24/TA21).
 */
export function isDevOrigin(origin: string): boolean
```

### `src/lib/display-setup.ts`

```typescript
/**
 * Derives a default gym name for the "personal display" flow.
 *
 *   - `displayName = "Alice Smith"`   → `"Alice Smith's Training"`
 *   - `displayName = ""` / null / ws  → `"My Training"`
 *   - `displayName = "a".repeat(100)` → `"aaaaa…(48 chars) 's Training"`
 *
 * The 48-char clamp keeps the derived name under the 60-char
 * `gyms.name` check constraint (48 + len(" 's Training") = 48 + 11 = 59).
 */
export function derivePersonalGymName(displayName: string | null | undefined): string
```

### `api/discovery.ts` (extension)

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'

function computeAppUrl(req: VercelRequest): string {
  // Prefer x-forwarded-proto (Vercel edge sets this for TLS-terminated requests)
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  const host = req.headers.host
  return `${proto}://${host}`
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  // ... existing CORS + OPTIONS handling ...

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_PUB_KEY
  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Discovery not configured' })
    return
  }

  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.status(200).json({
    version: '1',
    supabase_url: supabaseUrl,
    supabase_publishable_key: supabaseKey,
    app_url: computeAppUrl(req), // NEW
  })
}
```

### `src/lib/config-store.ts` (schema extension)

```typescript
// Existing schema gains one optional field.
export const backendConfigSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseKey: z.string().min(1),
  appUrl: z.string().url().optional(), // NEW — persisted at setup via discovery
})
```

Backward compatibility: Zod `.optional()` lets the schema accept any existing persisted config that predates F019. The D22 backfill form repairs missing `appUrl` values on the first Show-display tap.

### `src/lib/gym-error-messages.ts`

```typescript
/**
 * Maps a Postgres/PostgREST error to a user-facing message for the
 * gym-mutation action kind. Extracted from
 * `gym-management-section.tsx` for reuse by the F019 display
 * setup flow.
 */
export function gymErrorMessage(
  err: unknown,
  action: 'create' | 'join' | 'leave' | 'delete',
): string

export function isPgError(err: unknown): err is { code?: string; message?: string }
```

### `src/lib/copy-to-clipboard.ts`

```typescript
import { toast } from 'sonner'

interface CopyOptions {
  /** Toast message shown on success (required — silent success is confusing). */
  successMessage: string
  /** Toast message shown on failure (required — silent failure violates rules). */
  failureMessage: string
  /** Module prefix for console error logging. Defaults to 'clipboard'. */
  logPrefix?: string
}

/**
 * Wraps `navigator.clipboard.writeText` with toast feedback and
 * `[module-name]` console.error logging per `.claude/rules/error-handling.md`.
 * Returns the promise so callers can await success if they need to
 * chain (e.g., close a dialog on success).
 */
export async function copyToClipboard(text: string, options: CopyOptions): Promise<boolean>
```

### `src/hooks/use-qr-scanner.ts`

```typescript
/**
 * Hook wrapping `@tauri-apps/plugin-barcode-scanner` for one-shot
 * QR scans. Mirrors the imperative lifecycle in
 * `src/routes/setup.tsx:163-209` (the existing caller).
 *
 * Returns `null` outside Tauri (callers should hide scan UI).
 */
export interface UseQrScannerResult {
  scanning: boolean
  /** Opens the scanner; resolves with the decoded content or null on cancel. */
  scan: () => Promise<string | null>
  /** Cancels an in-flight scan. Safe to call when not scanning. */
  cancel: () => Promise<void>
}

export function useQrScanner(): UseQrScannerResult | null
```

### `src/components/display/display-dispatcher.tsx` (state machine)

```typescript
import type { Gym } from '@/domain/types'

export type DispatcherState =
  | { kind: 'unauthenticated' }
  | { kind: 'loading' }
  | { kind: 'error'; retry: () => void }
  | { kind: 'zero' }
  | { kind: 'single'; gymId: string }
  | { kind: 'many'; gyms: Gym[] }

/**
 * Pure function — no hooks, no side effects. Given the current auth
 * status and gym-list query state, returns the dispatcher state. Unit-
 * testable with mocked inputs; no need to render the component tree.
 */
export function computeDispatcherState(args: {
  authLoading: boolean
  user: { id: string } | null
  gymsLoading: boolean
  gymsError: boolean
  gyms: Gym[] | undefined
  refetch: () => void
}): DispatcherState
```

---

## Data Flow

### Inline "Show display" flow

```
User clicks Show display on MyGymRow for gym X
   │
   ▼
MyGymsList sets openRowId = X.id
   │
   ▼
MyGymRow (for X) receives isExpanded=true, renders <ShowDisplayPanel gym={X} />
   │
   ▼
ShowDisplayPanel resolves `origin`:
   │
   ├── isTauri() === false → origin = window.location.origin
   └── isTauri() === true  → origin = config.appUrl ?? null
                                        │
                                        └── (from persisted BackendConfig)
   │
   ▼
ShowDisplayPanel calls buildDisplayUrl(X.id, origin)
   │
   ├── origin is null → render D22 backfill form (server URL input + Save)
   │                       │
   │                       └── On Save: fetch `${input}/api/discovery`,
   │                                    validate, setConfig({..., appUrl}),
   │                                    re-render with populated origin
   └── origin is set  → render URL + Copy + QR + (dev-origin warning if isDevOrigin)
   │
   ▼
User clicks Copy → copyToClipboard(url, { success: 'Display URL copied', failure: '…' })
```

### Dispatcher decision flow

```
User navigates to /display
   │
   ▼
DisplayDispatcher renders
   │
   ├── useAuth()       → { user, loading: authLoading }
   ├── useGyms(userId) → { data, isLoading: gymsLoading, isError: gymsError, refetch }
   │
   ▼
computeDispatcherState({ authLoading, user, gymsLoading, gymsError, gyms: data, refetch })
   │
   ▼
switch (state.kind) {
   case 'unauthenticated': return <LegacyNotConfiguredPage />
   case 'loading':         return <DispatcherLoadingState />
   case 'error':           return <DispatcherErrorState retry={state.retry} />
   case 'zero':            return <DisplaySetupPanel userId={user.id} />
   case 'single':          return <Navigate to="/display/gym/$gymId"
                                            params={{ gymId: state.gymId }} replace />
   case 'many':            return <DisplayChooser gyms={state.gyms} userId={user.id} />
}
```

### Personal-display creation flow

```
User (0-gym or 2+ gym) clicks "Start a personal display"
   │
   ▼
Panel B / Chooser calls useCreateGym().mutate({ name: derivedName })
   │
   ├── derivedName = derivePersonalGymName(profile.displayName)
   │
   ▼
createGym hits supabase-adapter.createGym → INSERT INTO gyms
   │
   ▼
trg_gym_owner_enroll fires → INSERT INTO gym_members (gym_id, owner_user_id)
   │
   ▼
PostgREST returns the created Gym row → mutation onSuccess(newGym)
   │
   ▼
navigate({ to: '/display/gym/$gymId', params: { gymId: newGym.id }, replace: true })
   │
   ▼
/display/gym/$gymId renders — user sees their personal display
```

Note: query invalidation runs on `onSettled` after navigate, so the next `/profile` visit will already see the new gym in `MyGymsList`.

---

## Integration Points with F018

| F018 primitive                                             | How F019 uses it                                                                                        | Change?      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------ |
| `/display/gym/$gymId` route                                | Navigation target for the 1-gym redirect, chooser rows, personal-display success, and parser output     | **Zero**     |
| `src/lib/display-publisher.ts`                             | Untouched. Workout-start gym picker (F018) still drives `configureDisplayPublisher`                     | **Zero**     |
| `src/lib/display-subscriber.ts`                            | Untouched. Subscribes to `display:gym:{id}` on the TV route only                                        | **Zero**     |
| `src/lib/gym-channel.ts`                                   | Not imported by F019 — display-url.ts is a peer, not a consumer                                         | **Zero**     |
| `display-idle-snapshot` Edge Function                      | Untouched. Idle snapshots still flow per gym                                                            | **Zero**     |
| `gyms` / `gym_members` tables + RLS                        | F019 inserts one row per "personal display" via existing `createGym` path                               | **Zero DDL** |
| `useGyms(userId)` hook                                     | Consumed by `DisplayDispatcher` to count memberships and by `DisplayChooser` to render rows             | **Zero**     |
| `useCreateGym()` hook                                      | Consumed by `DisplaySetupPanel` Panel B and `DisplayChooser` (personal display row)                     | **Zero**     |
| `gym-picker-storage.ts` (sticky last-used gym)             | Not read or written by F019. Dispatcher is a setup flow, not a workout-start flow                       | **Zero**     |
| `useGymPicker` (workout-start picker)                      | Not used by F019                                                                                        | **Zero**     |
| `GymPickerSheet` visual tokens                             | `DisplayChooser` references the row styling but does not import the component                           | **Zero**     |
| `trg_auth_user_default_gym` (signup auto-enroll)           | Still handles new signups. F019 does not depend on it (handles the 0-gym case independently)            | **Zero**     |
| `trg_gym_owner_enroll` (creator auto-enroll, migration 04) | Load-bearing for the personal-display flow — ensures the creator is immediately a member of the new gym | **Zero**     |

---

## Testing Strategy

### Unit tests (pure functions)

| Module                  | Cases                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `display-url.ts`        | `parseDisplayUrlInput` accepts full URL / path-only / bare UUID, trims whitespace, rejects query strings, rejects non-UUID tails, rejects empty, surfaces distinct reason codes. `buildDisplayUrl` returns full URL when origin is set, `null` when origin is null. `isDevOrigin` matches `localhost:5173`, `http://127.0.0.1`, `http://[::1]:3000`; rejects production URLs. |
| `display-setup.ts`      | `derivePersonalGymName('Alice')` → `"Alice's Training"`. Null/undefined/whitespace → `"My Training"`. 100-char input → clamped to 48 + suffix.                                                                                                                                                                                                                                |
| `config-store.ts`       | `backendConfigSchema` accepts configs with and without `appUrl`. Setting and reading `appUrl` round-trips through both `BrowserConfigStore` and `TauriConfigStore` mocks.                                                                                                                                                                                                     |
| `api/discovery.ts`      | `computeAppUrl` builds `${proto}://${host}` from `req.headers`; defaults `proto` to `https` when unset; handles missing host gracefully (error path). Handler returns the new `app_url` field alongside existing fields.                                                                                                                                                      |
| `gym-error-messages.ts` | Snapshot of each PG code branch from the original helper. `isPgError` boundary cases (string, number, object with only `code`, object with only `message`).                                                                                                                                                                                                                   |
| `copy-to-clipboard.ts`  | Spy on `navigator.clipboard.writeText`, spy on `toast`, assert success path, failure path (rejected promise), and `[module-name]` console.error prefix.                                                                                                                                                                                                                       |

### Component tests

| Component             | Branches                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ShowDisplayPanel`    | Renders URL + Copy + QR when origin is valid (web `window.location.origin`, or Tauri `config.appUrl`). Renders the **D22 backfill form** when origin is null — server-URL input + Save button; Save calls discovery, persists `appUrl`, re-renders with populated URL. Renders dev-origin warning when origin is localhost. Copy button fires clipboard call and toast. |
| `DisplayDispatcher`   | Six state branches (unauthenticated, loading, error, zero, single, many). Loading state does not leak setup UI. Error state shows Retry that calls `refetch`. Single state fires `<Navigate replace>` to the correct path.                                                                                                                                              |
| `DisplayChooser`      | Renders N rows for N memberships. Rows are real `<a>` tags with correct hrefs. "Start a personal display" row fires createGym on click. Error surfacing via `gymErrorMessage`.                                                                                                                                                                                          |
| `DisplaySetupPanel`   | Panel A parser accepts all three input shapes, rejects malformed with inline error. Panel A Enter key submits. Panel A auto-focuses on mount. Panel A Scan QR button hidden when `isTauri()=false`, visible when true. Panel B calls createGym + navigates on success, shows error on failure.                                                                          |
| `MyGymRow` (modified) | Show display button present for all members (owner and non-owner). Tapping toggles `ShowDisplayPanel`. Tapping Show display on a second row closes the first.                                                                                                                                                                                                           |

### Integration tests

| Story | Test                                                                                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TA5   | Mount `<RouterProvider>` at `/display`. Mock auth=authenticated, mock adapter's `listUserGyms` → [{ id: 'gym-A' }]. Assert router navigates to `/display/gym/gym-A` via `history.replace`.                                                              |
| TA6   | Mount at `/display`. Mock adapter `listUserGyms` → [{ id: 'A' }, { id: 'B' }]. Assert chooser rendered with two rows.                                                                                                                                   |
| TA8   | Mount at `/display`. Mock adapter `listUserGyms` → []. Assert Panel A and Panel B rendered.                                                                                                                                                             |
| TA13  | Mount at `/display` with 0 gyms. Mock `createGym` to resolve with `{ id: 'new-gym', name: "Alice's Training", ... }`. Click "Start a personal display". Assert `createGym` called with correct name. Assert router navigates to `/display/gym/new-gym`. |

### QA smoke tests (manual, one-time)

1. Web build: profile → my gyms → show display → copy URL → paste URL in a browser on a different machine → TV loads and receives broadcasts when you start a workout in the app.
2. Tauri Android build, fresh setup via discovery: same flow. The copied URL must include the host the user typed at setup (e.g., `https://ardent-forge.vercel.app`), not `tauri://localhost`. Verify `config.appUrl` is populated in the Tauri SQLite `app_config` table.
3. Tauri Android build, pre-F019 persisted config (simulated by setting config without `appUrl` in SQLite and restarting): Show display panel renders the D22 backfill form; entering the server URL + Save populates `appUrl` and transitions to URL+Copy+QR.
4. Tauri Android build: 0-gym user taps "Start a personal display". Verify a new gym appears in Browse all gyms after the flow completes, and the TV loads.
5. Tauri Android build: Panel A → Scan QR → point camera at a QR rendered on a second device → navigates to `/display/gym/{id}`.
6. Self-hosted docker-compose instance: configure an instance with `SITE_URL=https://forge.example.com`, point the Tauri app at it, verify the display URL includes `forge.example.com` (not `tauri://localhost`, not the Supabase URL).

---

## Environment & Configuration

### No new env vars

F019 introduces **zero** new environment variables. The Tauri public-URL story is handled entirely through the existing discovery endpoint + persisted config path (D6, D21, D22).

### Deployment checklist (one-time, per instance)

For the `api/discovery.ts` change to deliver correct values, each deployment must ensure the serverless function sees the correct `Host` header:

| Deployment                 | Required                                                                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel (managed)           | No action — Vercel sets `Host` and `x-forwarded-proto` automatically on all deployments (preview + production).                                                                           |
| Self-hosted docker-compose | The Caddy reverse proxy already forwards `Host` and `X-Forwarded-Proto` based on `SITE_URL` in `.env`. No config change.                                                                  |
| Local dev (`vercel dev`)   | `Host: localhost:3000` (or similar) is returned. The D22 dev-origin warning fires correctly.                                                                                              |
| Preview deploys (Vercel)   | Each preview URL (`https://project-git-branch.vercel.app`) returns its own host via the discovery endpoint. Display URLs copied from a preview point at that preview — correct by design. |

### Schema migration path for existing persisted configs

The change to `backendConfigSchema` adds `appUrl` as **optional**, so every existing persisted config (browser localStorage + Tauri SQLite `app_config`) remains valid under the new schema. No data migration, no version bump, no corrupt-config clearing.

First user impact by category:

| User segment                                            | First Show-display experience                                                                                                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web user (any origin)                                   | No impact — origin comes from `window.location.origin`, `config.appUrl` is unused. URL renders immediately.                                                                                        |
| Tauri user with fresh setup post-F019                   | `appUrl` populated automatically by the discovery response during setup. URL renders immediately.                                                                                                  |
| Tauri user with pre-F019 persisted config               | `appUrl === undefined` → D22 backfill form on first Show display tap. User types server URL, tap Save, the panel re-fetches discovery, persists `appUrl`, renders URL. One-time friction per user. |
| Tauri user who bypassed discovery (Advanced mode setup) | Same as pre-F019 config → D22 backfill form on first Show display tap. One-time friction, rare path.                                                                                               |

---

## Open Questions (answer during implementation)

| ID  | Question                                                                                                                                                                                                                                                                                                                                                                    | Owner        | Default if unanswered                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | **D22 backfill form wording & affordance.** Should "Server URL" be labeled as such, or as "App URL", or "Ardent Forge server address"? Should the "What is this?" link open a dialog with a one-paragraph explanation, or navigate to a help page? The answer is purely UX copy — low stakes.                                                                               | fe-ui        | Label: "Server URL". "What is this?" opens a small inline popover with the paragraph: "The URL where your Ardent Forge app is hosted. This is the same URL you used when you first set up the app." No help page. |
| O2  | **Should the dispatcher's loading skeleton match the TV route's boot skeleton visually?** Visual consistency vs. distinct "this is not the TV" affordance.                                                                                                                                                                                                                  | fe-broadcast | Use a lighter skeleton than the TV route so the two are distinguishable at a glance.                                                                                                                              |
| O3  | **Should `copyToClipboard` also attempt `document.execCommand('copy')` as a fallback in v1, or capture it as a backlog item?** Spec S9 hedges on this.                                                                                                                                                                                                                      | fe-ui        | No fallback in v1. Capture `B00X — Tauri clipboard execCommand fallback` as backlog.                                                                                                                              |
| O4  | **Should `DisplayChooser` use `<Link>` (TanStack) or raw `<a href>`?** `<Link>` gives client-side nav but loses middle-click / hover-preview affordances.                                                                                                                                                                                                                   | fe-broadcast | `<Link>` — client-side nav is the primary UX; middle-click still works with `<Link>`.                                                                                                                             |
| O5  | **Should `ShowDisplayPanel` render the QR on mobile portrait (where screen width is narrow)?** May crowd the row.                                                                                                                                                                                                                                                           | fe-ui        | Render at `192×192` with `max-w-full` — responsive by default; revisit if it crowds rows.                                                                                                                         |
| O6  | **Should the D22 backfill form's "Save" error UI distinguish network failures from validation failures?** E.g., "Could not reach that server" vs "That server did not return a valid discovery response" vs "That URL is not a valid URL". Matters for debuggability but is implementation-level; not load-bearing for v1. Backlog candidate if operators report confusion. | fe-ui        | Single generic message "Could not verify that server. Check the URL and try again." Log the specific reason with `[display-setup]` prefix so operators can investigate via console captures.                      |

---

## Risks

| Risk                                                                                                                                                   | Likelihood | Impact                                               | Mitigation                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Tauri user has a pre-F019 persisted config (missing `appUrl`)                                                                                        | High       | One-time friction on first Show-display tap          | D22 backfill form repairs the config in place. The user types the server URL (the same one they entered at setup) and taps Save. Panel re-renders with URL + Copy + QR. Targets the narrow "upgrading" segment only. |
| `api/discovery.ts` deployed behind a reverse proxy that strips `Host` or `X-Forwarded-Proto`                                                           | Low        | `app_url` is wrong or malformed                      | `computeAppUrl` defaults `proto` to `https` and logs a warn if `host` is absent. Documented in the deployment checklist. Self-hosted docker-compose already forwards `Host`; Vercel is correct out of the box.       |
| A Tauri user went through Advanced-mode setup (entered Supabase URL + key directly, bypassing discovery)                                               | Low        | `appUrl` never populated                             | Same as pre-F019 config → D22 backfill form on first Show-display tap. Rare path.                                                                                                                                    |
| Extracting `gymErrorMessage` from `gym-management-section.tsx` breaks a test that snapshot-tests its text                                              | Low        | Test failures                                        | Re-export from the original file path; tests that import from the section continue to work unchanged. Run the full test suite after the extraction commit.                                                           |
| `useQrScanner` hook extraction changes `setup.tsx` behavior                                                                                            | Low-medium | Setup flow regression                                | Extract in a dedicated commit with no behavior change; run setup.tsx tests before and after; visual smoke on Tauri before merging.                                                                                   |
| Dispatcher 1-gym `<Navigate replace>` behaves differently on TanStack Router's latest version                                                          | Low        | Flash of dispatcher before redirect                  | Version pinned; existing codebase uses `<Navigate>` elsewhere (see `conversation-detail.tsx`, `event-countdown-badge.tsx`). Integration test TA5 catches regressions.                                                |
| Personal-display creation lands on the new display page before the query invalidation has propagated, so returning to profile briefly shows stale data | Low        | Mild UI inconsistency for < 1s                       | Acceptable. `useCreateGym` invalidates `['gyms']` on `onSettled` which runs regardless of navigate. Next profile visit shows the new row.                                                                            |
| `navigator.clipboard.writeText` rejects on a Tauri Android webview version                                                                             | Low        | Copy UX feels broken                                 | `copyToClipboard` catches and shows an inline toast directing users to long-press-select. O3 captures the execCommand fallback as a backlog item.                                                                    |
| Parser accepts a URL with a trailing slash (`/display/gym/{uuid}/`) and Zod rejects the UUID because of the trailing slash                             | Medium     | Inline error UX for a common paste shape             | Parser normalizes: strip trailing `/`, strip `?query`, strip `#fragment` before extracting the UUID. Covered by unit tests in `display-url.test.ts`.                                                                 |
| A `display_name` containing Unicode graphemes (emoji, combining marks) breaks the 48-char clamp (JS `.length` is code-unit, not grapheme)              | Low        | Clamp produces an unexpected fragment, or exceeds 60 | Use `[...str].slice(0, 48).join('')` for code-point clamping; document that grapheme clusters are beyond v1 scope. Unit test covers the 48-byte edge. Fallback `"My Training"` always safe.                          |
| User creates many personal displays across sessions, cluttering the Browse all gyms list                                                               | Low        | UX noise at scale                                    | Non-goal per Spec W4-area; future follow-up could add an `is_personal` flag + a "Hide personal gyms" toggle. Captured as backlog candidate.                                                                          |
| `DisplayChooser`'s "Start a personal display" row is tapped accidentally by a multi-gym user                                                           | Low        | They get an extra gym they didn't intend             | Place the row at the bottom of the list, not the top. Use a muted tonal surface so it doesn't compete with real gym rows. They can delete the auto-gym from profile.                                                 |

---

## Rollout

1. **Branch from current worktree** (`worktree-feat+multipe-instance-display`) — the F018 base is already merged there.
2. **Implement in waves** per Steps.md (next phase).
3. **PR to `develop`** — per user memory "PR target branch rule".
4. **Merge blocker: CI green + manual Tauri Android smoke test** per risks table row 3.
5. **No release tag needed in v1** — the feature is additive UX that ships with whatever release follows normally. Tag on `main` per user memory "Tags on main".
6. **Post-release monitoring** (first 24h): watch for `[display-setup]`, `[display-dispatcher]`, `[display-url]` console errors via operator feedback. No automated analytics.

---

## Revision History

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Author |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-04-07 | Initial draft. Resolves Spec.md open questions Q1-Q5 via D2/D3 (parser + URL module), D14 (dispatcher file split), D13 (single-row-open UX), D16 (no feature flag). First cut proposed a build-time `VITE_PUBLIC_APP_URL` env var for Tauri public-URL resolution.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Claude |
| 2026-04-07 | **Revised D6 after user pushback.** Replaced the build-time env var with a discovery-endpoint extension: `api/discovery.ts` returns `app_url` derived from `req.headers.host`, `backendConfigSchema` gains optional `appUrl`, persisted at setup time alongside Supabase config. New D21 (discovery mechanics) and D22 (backfill form for pre-F019 configs and Advanced-mode users). Removed `public-app-url.ts` module and its tests; removed `VITE_PUBLIC_APP_URL` from env vars, `.env.example`, and the Environment section. Added `api/discovery.ts`, `src/lib/config-store.ts`, and `src/lib/discovery.ts` to Modified files. Reason: user correctly identified that the information is already captured at setup — baking it at build time was over-engineered. | Claude |
