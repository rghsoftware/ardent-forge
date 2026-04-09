# Implementation Steps: Gym Membership Explicit

**Spec:** [Context/Features/021-Gym-Membership-Explicit/Spec.md](./Spec.md)
**Tech:** [Context/Features/021-Gym-Membership-Explicit/Tech.md](./Tech.md)

## Progress

- **Status:** Not started
- **Current task:** —
- **Last milestone:** —

## Team Orchestration

### Team Members

- **builder-db**
  - Role: Supabase migrations, RLS, RPCs, SQL tests
  - Agent Type: backend-engineer
  - Resume: true
- **builder-ui**
  - Role: React routes, hooks, components, adapter, Vitest, Playwright
  - Agent Type: frontend-specialist
  - Resume: true
- **scribe**
  - Role: ADR authoring + documentation updates
  - Agent Type: general-purpose
  - Resume: false
- **validator**
  - Role: Quality validation (read-only)
  - Agent Type: quality-engineer
  - Resume: false

## Tasks

### Phase 0 — Foundation (ADRs + pgcrypto)

- [ ] S001-D: Author `Context/Decisions/ADR-015-gym-ownership-transfer-schema.md` capturing the dedicated-table + `gym_id` PK invariant + lifecycle-via-RPC decision (Tech.md Decision 1).
  - **Assigned:** scribe
  - **Depends:** none
  - **Parallel:** true
- [ ] S002-D: Author `Context/Decisions/ADR-015-invite-token-redemption-via-rpc.md` capturing the `security definer` redemption choice + structured `INVITE_*` error taxonomy (Tech.md Decisions 2 + 4).
  - **Assigned:** scribe
  - **Depends:** none
  - **Parallel:** true
- [ ] S003: Create migration `supabase/migrations/20260408000001_enable_pgcrypto.sql` with `create extension if not exists "pgcrypto"`.
  - **Assigned:** builder-db
  - **Depends:** none
  - **Parallel:** true

🏁 **MILESTONE:** Foundation complete — ADRs written, `pgcrypto` available. No assertion gates yet.
**Contracts:**

- `Context/Decisions/ADR-015-gym-ownership-transfer-schema.md` — schema + lifecycle decisions for the transfer table
- `Context/Decisions/ADR-015-invite-token-redemption-via-rpc.md` — redemption RPC + error taxonomy
- `supabase/migrations/20260408000001_enable_pgcrypto.sql` — extension availability for token generation

### Phase 1 — Main migration (drops, tables, view, RLS, RPCs)

- [ ] S004: Create `supabase/migrations/20260408000002_gym_membership_explicit.sql`. Sections in order: (a) drop trigger `trg_auth_user_default_gym`; (b) drop function `public.enroll_new_user_in_default_gym()`; (c) drop partial unique index `idx_gyms_one_default`; (d) `alter table gyms drop column is_default`; (e) `create table gym_invitations` with columns, checks, indexes per Tech.md; (f) `create table gym_ownership_transfers` with `gym_id` PK; (g) `create view gym_member_counts with (security_invoker = true)`; (h) enable RLS + policies on both new tables; (i) `create function create_gym_invite`, `redeem_gym_invite`, `propose_gym_transfer`, `accept_gym_transfer`, `cancel_or_decline_gym_transfer` (all `security definer`, `set search_path = public`); (j) `grant execute ... to authenticated` on each RPC; (k) `grant select on gym_member_counts to authenticated`.
  - **Assigned:** builder-db
  - **Depends:** S003
  - **Parallel:** false
- [ ] S004-T: Create `supabase/tests/021_is_default_drop.sql` asserting A-001 (trigger gone), A-002 (function gone), A-003 (column gone), A-006 (backfilled `gym_members` rows preserved). Pattern: `begin ... do $$ ... rollback` per `018_trigger.sql`.
  - **Assigned:** builder-db
  - **Depends:** S004
  - **Parallel:** true
- [ ] S004-T2: Create `supabase/tests/021_no_signup_enrollment.sql` asserting A-004 (new auth.users insert → zero gym_members rows) and A-005 (gym create still auto-enrolls owner via 20260407000004 trigger — regression guard).
  - **Assigned:** builder-db
  - **Depends:** S004
  - **Parallel:** true
- [ ] S004-T3: Create `supabase/tests/021_invite_lifecycle.sql` asserting A-014 (token length ≥ 24, future `expires_at`), A-015 (redeem increments + inserts member), A-016 (expired → `INVITE_EXPIRED`), A-017 (exhausted → `INVITE_EXHAUSTED`), A-018 (non-owner SELECT returns zero rows).
  - **Assigned:** builder-db
  - **Depends:** S004
  - **Parallel:** true
- [ ] S004-T4: Create `supabase/tests/021_ownership_transfer.sql` asserting A-012 (propose creates pending, owner unchanged), A-013 (propose to non-member errors), A-013a (accept flips + clears), A-013b (decline + cancel paths), A-013c (single-pending invariant via PK on supersede).
  - **Assigned:** builder-db
  - **Depends:** S004
  - **Parallel:** true
- [ ] S005-V: Validate S004 migration + SQL tests. Inspect the migration for idempotency concerns, RLS-policy coverage on the two new tables, grant correctness, and that every RPC is `security definer` with locked `search_path`. Run all four SQL test files and confirm pass.
  - **Assigned:** validator
  - **Depends:** S004, S004-T, S004-T2, S004-T3, S004-T4
  - **Parallel:** false

🏁 **MILESTONE:** Database layer complete — verify against A-001, A-002, A-003, A-004, A-005, A-006, A-012, A-013, A-013a, A-013b, A-013c, A-014, A-015, A-016, A-017, A-018.
**Contracts:**

- `supabase/migrations/20260408000002_gym_membership_explicit.sql` — canonical schema + RPC signatures for adapter consumers
- `src/lib/database.types.ts` (to be regenerated in Phase 2 from this migration)

### Phase 2 — Adapter, types, `is_default` cleanup

- [ ] S006: Regenerate `src/lib/database.types.ts` against the new schema (`bunx supabase gen types typescript --local > src/lib/database.types.ts`). Expect `gyms.is_default` to disappear and `gym_invitations`, `gym_ownership_transfers`, `gym_member_counts` to appear.
  - **Assigned:** builder-ui
  - **Depends:** S005-V
  - **Parallel:** false
- [ ] S007: Update `src/domain/types/gym.ts` — drop `isDefault` from `Gym`; add `GymInvitation`, `GymOwnershipTransfer`, `GymMemberCount`, and a discriminated `RedeemInviteError = { kind: 'invalid' | 'expired' | 'exhausted' }` with Zod schemas per ADR-008.
  - **Assigned:** builder-ui
  - **Depends:** S006
  - **Parallel:** false
- [ ] S008: Update `src/lib/data-mapper.ts` — strip `is_default` mapping, add mappers for the three new domain types.
  - **Assigned:** builder-ui
  - **Depends:** S007
  - **Parallel:** true
- [ ] S008-T: Update `src/lib/__tests__/data-mapper-gym.test.ts` — remove `is_default` assertions, add round-trip tests for new mappers.
  - **Assigned:** builder-ui
  - **Depends:** S008
  - **Parallel:** true
- [ ] S009: Extend `src/lib/supabase-adapter.ts` — (a) remove `is_default` from `createGym`/`updateGym`/`getGym`/`listAllGyms`/`listUserGyms` return shapes; (b) add `listGymMemberCounts()` hitting the view; (c) add `createGymInvite(gymId, { expiresAt?, maxUses? })`, `listGymInvites(gymId)`, `redeemGymInvite(token)` with error-message parsing for `INVITE_*` → discriminated union; (d) add `proposeGymTransfer`, `acceptGymTransfer`, `cancelOrDeclineGymTransfer`, `getPendingTransfer(gymId)`.
  - **Assigned:** builder-ui
  - **Depends:** S007
  - **Parallel:** true
- [ ] S009-T: Update `src/lib/__tests__/supabase-adapter-gym.test.ts` — remove `is_default` assertions. Add new tests covering the new adapter methods with mocked Supabase client, including the `INVITE_*` error taxonomy mapping.
  - **Assigned:** builder-ui
  - **Depends:** S009
  - **Parallel:** false
- [ ] S010-V: Validate Phase 2 — run `bun run build` (typecheck + Vite build) and `bun run test` for the adapter + mapper test suites. Confirm zero `is_default` references remain in `src/`.
  - **Assigned:** validator
  - **Depends:** S006, S007, S008, S008-T, S009, S009-T
  - **Parallel:** false

🏁 **MILESTONE:** Adapter layer complete — typecheck clean, `is_default` purged from frontend, new RPCs callable from TypeScript.
**Contracts:**

- `src/domain/types/gym.ts` — `Gym`, `GymInvitation`, `GymOwnershipTransfer`, `GymMemberCount`, `RedeemInviteError`
- `src/lib/supabase-adapter.ts` — new adapter method signatures downstream hooks consume
- `src/lib/database.types.ts` — regenerated, no `is_default`

### Phase 3 — Hooks

- [ ] S011: Create `src/hooks/use-gym-invites.ts` — `useListGymInvites(gymId)`, `useCreateGymInvite()`, `useRedeemGymInvite()`. Every mutation has `onError` with `[gym-invites]` prefix log and optimistic rollback where applicable. Query keys `['gym-invites', gymId]`. Never log the raw token; log `invite.id` instead.
  - **Assigned:** builder-ui
  - **Depends:** S010-V
  - **Parallel:** true
- [ ] S011-T: `src/hooks/__tests__/use-gym-invites.test.ts` — mock adapter; assert error-kind discrimination (`invalid`/`expired`/`exhausted`), `onError` prefix logging, cache invalidation after create/redeem.
  - **Assigned:** builder-ui
  - **Depends:** S011
  - **Parallel:** true
- [ ] S012: Create `src/hooks/use-gym-transfers.ts` — `usePendingGymTransfer(gymId)`, `useProposeGymTransfer()`, `useAcceptGymTransfer()`, `useCancelOrDeclineGymTransfer()`. `[gym-transfers]` prefix logging and optimistic rollback.
  - **Assigned:** builder-ui
  - **Depends:** S010-V
  - **Parallel:** true
- [ ] S012-T: `src/hooks/__tests__/use-gym-transfers.test.ts` — mock adapter; assert propose/accept/decline/cancel mutation paths, error prefix logging, cache invalidation of `['gyms', 'detail', gymId]` after accept.
  - **Assigned:** builder-ui
  - **Depends:** S012
  - **Parallel:** true
- [ ] S013: Extend `src/hooks/use-gyms.ts` — add `useListAllGymsWithCounts()` joining `listAllGyms` with `listGymMemberCounts`. Keep existing mutations intact; remove any `is_default` plumbing.
  - **Assigned:** builder-ui
  - **Depends:** S010-V
  - **Parallel:** true
- [ ] S013-T: Extend `src/hooks/__tests__/use-gyms.test.ts` — assert `useListAllGymsWithCounts` returns correct counts for seeded gyms.
  - **Assigned:** builder-ui
  - **Depends:** S013
  - **Parallel:** true
- [ ] S014: Extend `src/hooks/use-gym-members.ts` — add `useGymRoster(gymId)` that joins `listGymMembers` with `user_profiles.display_name` for the detail page.
  - **Assigned:** builder-ui
  - **Depends:** S010-V
  - **Parallel:** true
- [ ] S014-T: Extend `src/hooks/__tests__/use-gym-members.test.ts` — assert roster hook returns members sorted by `joined_at` with display names.
  - **Assigned:** builder-ui
  - **Depends:** S014
  - **Parallel:** true
- [ ] S015-V: Validate Phase 3 — run `bun run test` for all hook test files; confirm every new mutation has `[gyms]` / `[gym-invites]` / `[gym-transfers]` prefixed `onError` per A-021.
  - **Assigned:** validator
  - **Depends:** S011, S011-T, S012, S012-T, S013, S013-T, S014, S014-T
  - **Parallel:** false

🏁 **MILESTONE:** Hook layer complete — A-021 verified.
**Contracts:**

- `src/hooks/use-gym-invites.ts` — invite mutation/query API
- `src/hooks/use-gym-transfers.ts` — transfer mutation/query API
- `src/hooks/use-gyms.ts` — extended with `useListAllGymsWithCounts`
- `src/hooks/use-gym-members.ts` — extended with `useGymRoster`

### Phase 4 — UI components + routes

- [ ] S016: Create `src/components/profile/gym-detail/gym-detail-header.tsx` — renders gym name, owner display name, member count. ALL-CAPS column headers only; mixed-case for body copy per typography rules. No divider lines.
  - **Assigned:** builder-ui
  - **Depends:** S015-V
  - **Parallel:** true
- [ ] S017: Create `src/components/profile/gym-detail/gym-roster.tsx` — table of members with display name and `joined_at`. Uses `useGymRoster`.
  - **Assigned:** builder-ui
  - **Depends:** S015-V
  - **Parallel:** true
- [ ] S018: Create `src/components/profile/gym-detail/gym-owner-actions.tsx` — owner-only panel: rename, delete (with confirm dialog), kick (per-row control on roster), propose-transfer (member picker), generate-invite (launches invite dialog). Collapsed by default per Should-Have.
  - **Assigned:** builder-ui
  - **Depends:** S015-V
  - **Parallel:** true
- [ ] S019: Create `src/components/profile/gym-detail/pending-transfer-banner.tsx` — visible on detail page when `usePendingGymTransfer` returns a row; renders accept/decline for the target and cancel for the proposer.
  - **Assigned:** builder-ui
  - **Depends:** S015-V
  - **Parallel:** true
- [ ] S020: Create `src/components/profile/gym-detail/gym-invite-dialog.tsx` — generate-invite form (override defaults 7d / 10 uses), copy link button, QR rendering. Reuse whatever QR infra Feature 010 provides; if only a Lucide icon exists, import `qrcode.react` or equivalent already in deps (verify at build time).
  - **Assigned:** builder-ui
  - **Depends:** S015-V
  - **Parallel:** true
- [ ] S021: Create route `src/routes/_authenticated/profile.gyms.$gymId.tsx` composing the four detail components + leave-gym action for non-owner members + join action for non-members. `mx-auto max-w-5xl` wrapper per layout rules. Empty/loading/error states for all queries per `.claude/rules/error-handling.md`.
  - **Assigned:** builder-ui
  - **Depends:** S016, S017, S018, S019, S020
  - **Parallel:** false
- [ ] S022: Create route `src/routes/gyms.join.tsx` (outside `_authenticated`). Reads `?token=` param, strips it from URL via `navigate({ replace: true })`, checks auth; unauth → redirect to sign-in with `returnTo=/gyms/join?token=...`; authed → call `useRedeemGymInvite`, branch on discriminated error, on success navigate to `/profile/gyms/$gymId`.
  - **Assigned:** builder-ui
  - **Depends:** S015-V
  - **Parallel:** true
- [ ] S023: Update `src/components/profile/gym-management-section.tsx` — swap `--` placeholder for real member counts via `useListAllGymsWithCounts`; wrap each gym row with a link to `/profile/gyms/$gymId`. Remove any `is_default` / `isDefault` references.
  - **Assigned:** builder-ui
  - **Depends:** S015-V
  - **Parallel:** true
- [ ] S024: Update `src/lib/deep-link-handler.ts` — recognize `ardentforge://gyms/join?token=...` and dispatch to the `/gyms/join` route, parity with F011's `/setup` dispatch.
  - **Assigned:** builder-ui
  - **Depends:** S015-V
  - **Parallel:** true
- [ ] S025-V: Validate Phase 4 — run `bun run build` + `bun run lint`. Confirm every touched page has the `mx-auto max-w-5xl` wrapper and zero `border-[tblr] border-surface-*` usages on new code.
  - **Assigned:** validator
  - **Depends:** S021, S022, S023, S024
  - **Parallel:** false

🏁 **MILESTONE:** UI layer complete — all routes + components wired.
**Contracts:**

- `src/routes/_authenticated/profile.gyms.$gymId.tsx` — detail page route
- `src/routes/gyms.join.tsx` — redemption deep link route
- `src/components/profile/gym-detail/*` — component bundle for reuse

### Phase 5 — End-to-end tests

- [ ] S026-T: Playwright `e2e/gym-detail.spec.ts` — seed gym + 3 members; assert roster renders (A-007); sign in as non-owner and assert owner controls absent (A-008); owner kicks a member (A-009); owner renames gym (A-010); owner deletes gym (A-011).
  - **Assigned:** builder-ui
  - **Depends:** S025-V
  - **Parallel:** true
- [ ] S027-T: Playwright `e2e/gym-invites.spec.ts` — generate invite as owner, copy link, sign in as second user, redeem via `/gyms/join?token=...`, assert membership; force expiry and assert distinct error state; force exhaustion and assert distinct error state.
  - **Assigned:** builder-ui
  - **Depends:** S025-V
  - **Parallel:** true
- [ ] S028-T: Playwright `e2e/gym-ownership-transfer.spec.ts` — propose, accept, decline, cancel, and supersede flow (propose twice, assert second supersedes first).
  - **Assigned:** builder-ui
  - **Depends:** S025-V
  - **Parallel:** true
- [ ] S029-T: Playwright `e2e/zero-gym-state.spec.ts` — fresh user signs up, visits profile + display picker, asserts empty states render without errors (A-020).
  - **Assigned:** builder-ui
  - **Depends:** S025-V
  - **Parallel:** true
- [ ] S030-T: Playwright `e2e/browse-member-counts.spec.ts` — seed two gyms with 1 and 3 members; assert rendered counts (A-019).
  - **Assigned:** builder-ui
  - **Depends:** S025-V
  - **Parallel:** true
- [ ] S031-V: Run full Playwright suite. Confirm all five spec files pass.
  - **Assigned:** validator
  - **Depends:** S026-T, S027-T, S028-T, S029-T, S030-T
  - **Parallel:** false

🏁 **MILESTONE:** E2E coverage complete — verify A-007, A-008, A-009, A-010, A-011, A-019, A-020.

### Phase 6 — Final validation + docs

- [ ] S032-D: Update `CLAUDE.md` project context if any new architectural pattern (two-step ownership transfer, invite taxonomy) should be surfaced. Otherwise skip.
  - **Assigned:** scribe
  - **Depends:** S031-V
  - **Parallel:** true
- [ ] S033-D: Update `README.md` if the zero-gym state changes first-run onboarding copy. Otherwise skip.
  - **Assigned:** scribe
  - **Depends:** S031-V
  - **Parallel:** true
- [ ] S034-V: Final full-feature validation — run `bun run build`, `bun run lint`, `bun run test`, full Playwright suite, and all `supabase/tests/021_*.sql` files. Full drift check against every testable assertion A-001 through A-021. Confirm no TODO/FIXME stubs.
  - **Assigned:** validator
  - **Depends:** S031-V, S032-D, S033-D
  - **Parallel:** false

🏁 **MILESTONE:** Feature complete — verify all assertions A-001 through A-021, full drift check.

## Acceptance Criteria

- [ ] All testable assertions A-001 through A-021 from Spec.md verified
- [ ] All SQL tests, Vitest suites, and Playwright suites passing
- [ ] Zero `is_default` references remain in `src/`
- [ ] Both ADR-015 files exist and are referenced by Tech.md
- [ ] No TODO/FIXME stubs remaining in touched files
- [ ] `bun run build` clean (typecheck + Vite)
- [ ] `bun run lint` clean

## Validation Commands

```bash
# Database
npx supabase db reset                              # apply all migrations fresh
psql $DATABASE_URL -f supabase/tests/021_is_default_drop.sql
psql $DATABASE_URL -f supabase/tests/021_no_signup_enrollment.sql
psql $DATABASE_URL -f supabase/tests/021_invite_lifecycle.sql
psql $DATABASE_URL -f supabase/tests/021_ownership_transfer.sql

# Frontend
bun run build                                      # typecheck + Vite
bun run lint                                       # ESLint
bun run test                                       # Vitest (full suite)
bunx playwright test e2e/gym-detail.spec.ts \
                    e2e/gym-invites.spec.ts \
                    e2e/gym-ownership-transfer.spec.ts \
                    e2e/zero-gym-state.spec.ts \
                    e2e/browse-member-counts.spec.ts
```
