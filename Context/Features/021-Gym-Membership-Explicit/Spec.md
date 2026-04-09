# Feature 021: Gym Membership Explicit

## Overview

Decouple Supabase-instance signup from gym membership and build out the gym
membership CRUD UI. Gym membership becomes explicit and opt-in for every user,
and gym owners gain the tools to manage their gym's roster, identity, invites,
and ownership transfer.

Addresses GitHub issue [#94](https://github.com/rghsoftware/ardent-forge/issues/94):
"instance membership should not imply gym membership".

## Problem Statement

Feature 018 (Gym-Scoped Displays) introduced gyms as the unit that scopes
workout broadcasts. To ship it quickly on a friends-and-family instance, 018
bundled two separate concepts:

1. **Instance membership** — a row in `auth.users` created by signup.
2. **Gym membership** — a row in `gym_members` granting access to a specific
   gym's display broadcasts and programming.

Today these are coupled in two places:

- **New signups** are auto-enrolled in the "Home" default gym via the
  `trg_auth_user_default_gym` trigger on `auth.users` insert
  (`20260407000001_create_gyms.sql:241-272`).
- **Existing users** were backfilled into the Home gym by the one-shot
  migration block in the same file (lines 318-366), and a `gyms.is_default`
  flag marks that gym.

This coupling has three problems:

- **Privacy leak**: any new user on the instance is immediately part of the
  Home gym's broadcast roster without consenting.
- **Scaling**: as soon as the instance has more than one household, "default
  gym" is incoherent — whose Home?
- **No admin tooling**: gym owners cannot see their roster, kick members,
  rename or delete the gym cleanly, transfer ownership, or invite specific
  people. The existing UI exposes only create/browse/join/leave at the list
  level. Member counts render as `--` (placeholder).

This feature makes gym membership fully explicit and gives owners the tools
they need to actually run a gym.

## User Stories

- As a **new user**, I sign up and land with zero gym memberships, so I
  explicitly choose which (if any) gyms to join before my workouts can appear
  on anyone's broadcast.
- As a **gym owner**, I want a detail page for my gym where I can see the
  full member roster with display names, so I know who is currently in.
- As a **gym owner**, I want to kick a member from my gym, so I can revoke
  access when someone leaves the household or group.
- As a **gym owner**, I want to rename or delete my gym from its detail page,
  so gym identity stays accurate and I can clean up unused gyms.
- As a **gym owner**, I want to transfer ownership of my gym to another
  current member, so succession is possible without deleting and recreating.
- As a **gym owner**, I want to generate a time-limited invite token I can
  share with specific people, so I can grow my gym without opening it to the
  entire instance.
- As an **invitee**, I want to redeem an invite token and be added to the
  gym atomically, so joining is one-tap from a link the owner sent me.
- As a **gym member**, I want to leave a gym from its detail page, so I can
  drop out without hunting through the profile settings list.
- As a **user browsing gyms**, I want to see an accurate member count for
  each gym, so I can judge the gym's activity before joining.
- As an **existing user** who was auto-enrolled in the Home gym during the
  018 backfill, I want to keep that membership (grandfathered) and be able
  to leave voluntarily, so this migration does not silently remove my access.

## Requirements

### Must Have

**Decoupling**

- The `trg_auth_user_default_gym` trigger on `auth.users` is dropped.
- The `enroll_new_user_in_default_gym()` function is dropped.
- The `gyms.is_default` column is dropped along with all code and UI
  references to it.
- No code path enrolls a user in any gym as a side effect of `auth.users`
  insert.
- Existing `gym_members` rows from the 018 backfill are preserved — no
  destructive cleanup. Affected users keep their Home gym membership until
  they voluntarily leave.
- The intentional owner auto-enrollment trigger on `gyms` insert
  (`20260407000004_enroll_gym_creator.sql`) is retained unchanged.

**Gym detail page**

- A route at `/profile/gyms/$gymId` renders a detail page for any gym the
  current user can see (i.e., any gym — SELECT is instance-wide per 018
  RLS). The route nests under the profile routing group so gym admin
  lives alongside the existing gym-management section.
- The detail page shows gym name, owner display name, member count, and
  the full member roster with display names, sorted by `joined_at`.
- An owner-only "Manage" section on the detail page exposes: rename,
  delete, kick a member, transfer ownership, generate invite.
- A member-only "Leave gym" action is available on the detail page for any
  member who is not the owner.
- Non-member visitors see a "Join" action on the detail page (same behavior
  as the browse list today).

**Ownership transfer (two-step)**

- An owner proposes a transfer by selecting a current member as the
  target. A pending-transfer record is stored against the gym; ownership
  does not change until the target accepts.
- The target member sees the pending proposal on their gym detail page
  and can accept or decline.
- On accept, `gyms.owner_user_id` flips to the target atomically and the
  pending record is cleared.
- On decline (or if the proposing owner cancels), the pending record is
  cleared without changing ownership.
- At most one pending transfer exists per gym at a time; a new proposal
  supersedes any existing one.
- After a successful transfer, the former owner remains a member (not
  auto-removed) and loses all owner-only capabilities.
- The owner cannot propose a transfer to a non-member or to themselves.

**Invite flow**

- A new `gym_invitations` table stores invite tokens with `gym_id`,
  `token` (opaque, cryptographically random), `created_by`, `created_at`,
  `expires_at`, `max_uses`, `uses_count`, and a unique index on `token`.
- Only the gym owner can create invites for a given gym.
- Invites have a default lifetime (e.g., 7 days) and a default `max_uses`
  (e.g., 10); both are settable when the owner generates the invite.
- An authenticated user can redeem a valid, unexpired, under-quota invite
  via an RPC that inserts the `gym_members` row and increments `uses_count`
  atomically.
- Default invite lifetime is **7 days**; default `max_uses` is **10**. Owners
  can override both values at generation time.
- An invite link has a stable URL shape under the app's existing host
  (e.g., `/gyms/join?token=...`).
- Expired or exhausted invites return a distinct error so the UI can render
  a clear "This invite is no longer valid" state rather than a generic
  failure.

**Gym CRUD UI expansion**

- The existing browse list in `gym-management-section.tsx` renders a real
  member count per gym (not the `--` placeholder).
- The existing browse list links each gym row to its detail page.
- An owner can rename a gym from the detail page; the new name is subject
  to the same 1-60 character validation as create.
- An owner can delete a gym from the detail page, with a confirmation
  dialog that states the action is irreversible and removes all members.
- All mutations (rename, delete, kick, transfer, invite create, invite
  redeem, leave) use `useMutation` hooks with `onError` handlers that log
  with a `[gyms]` or `[gym-invites]` prefix and roll back optimistic
  updates where applicable (per `.claude/rules/error-handling.md`).

**Zero-gym state**

- A user with zero gym memberships can use the app without errors. Surfaces
  that previously assumed at least one gym (display picker, broadcast
  surfaces) render an empty state with a CTA linking to gym browse/create.
- Onboarding (Feature 015) is not modified to force a gym selection.

**RLS & security**

- New `gym_invitations` policies: only the owner can SELECT invites for
  their gym; only the owner can INSERT; redemption goes through a
  `security definer` RPC that validates the token.
- Ownership transfer goes through a `security definer` RPC that validates
  the caller is the current owner and the target is a current member.
- Rename, delete, kick remain on the existing owner-gated policies.

### Should Have

- The gym detail page shows each member's `joined_at` date in a
  human-readable column.
- The invite generation UI shows a copyable link and a QR code
  (leverages existing QR infrastructure from Feature 010).
- The owner-only manage section is collapsed by default to keep the
  detail page uncluttered for non-owners.
- Member count on the browse list is cached per-query to avoid N+1
  against `gym_members`.

### Won't Have (this iteration)

- Per-member roles beyond owner / member (no coach/trainer/admin tier).
- Email-delivered invites. Invites are link-based only; the owner is
  responsible for getting the link to the invitee.
- Invite revocation UI (owner can only wait for expiry or let uses
  exhaust). Revocation may be added later.
- Audit log of kicks, transfers, or invite redemptions beyond the
  `gym_members.joined_at` timestamp.
- Migration of existing Home gym memberships into per-user default state.
  Grandfathered rows stay as-is until the user leaves. The "Home" gym
  itself is kept (not renamed, not deleted) so grandfathered users can
  still find it in the browse list.
- Invite-redemption attribution analytics. `gym_invitations.uses_count`
  plus `gym_members.joined_at` are enough for v1; a richer events
  pipeline can be added later without schema churn.
- Any change to display-broadcast scoping logic or idle-session RPCs —
  those continue to read `gym_members` unchanged.
- Self-service gym discovery beyond the existing browse list.

## Testable Assertions

| ID     | Assertion                                                                                                                                                      | Verification                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A-001  | After the migration runs, `pg_trigger` contains no trigger named `trg_auth_user_default_gym`.                                                                  | SQL: `select 1 from pg_trigger where tgname='trg_auth_user_default_gym'` returns zero rows.                    |
| A-002  | After the migration runs, `pg_proc` contains no function named `enroll_new_user_in_default_gym`.                                                               | SQL: `select 1 from pg_proc where proname='enroll_new_user_in_default_gym'` returns zero rows.                 |
| A-003  | After the migration runs, `gyms.is_default` does not exist as a column.                                                                                        | SQL: `information_schema.columns` query for that column returns zero rows.                                     |
| A-004  | Creating a brand-new `auth.users` row produces zero new `gym_members` rows for that user.                                                                      | Supabase integration test: insert user, count `gym_members` where `user_id = new.id` → expect 0.               |
| A-005  | Creating a gym still auto-enrolls the creator (`20260407000004` unchanged).                                                                                    | Integration test: insert gym, expect exactly one `gym_members` row with `(new_gym.id, owner_user_id)`.         |
| A-006  | Existing `gym_members` rows created by the 018 backfill remain after the 021 migration.                                                                        | Snapshot `gym_members` row-count pre-migration; post-migration row count is ≥ the snapshot.                    |
| A-007  | The route `/profile/gyms/$gymId` renders the gym's name, owner display name, member count, and a roster row for every `gym_members` row.                       | Playwright E2E: seed a gym with three members, navigate to detail, assert all three display names are visible. |
| A-008  | A non-owner visiting the detail page does not see rename, delete, kick, propose-transfer, or generate-invite controls.                                         | Playwright E2E: sign in as member, visit detail page, assert those controls are not in the DOM.                |
| A-009  | An owner can kick a member, and after the kick the target user's `gym_members` row for that gym no longer exists.                                              | Integration test: call kick RPC/mutation as owner, query `gym_members`, expect zero rows.                      |
| A-010  | An owner can rename a gym to a 1-60 character name and the new name is persisted.                                                                              | Integration test: update name to "Forge North", reselect gym, expect new name.                                 |
| A-011  | An owner can delete a gym, and after deletion the `gyms` row and all its `gym_members` rows are removed.                                                       | Integration test: delete gym, expect zero rows in both tables for that `gym_id`.                               |
| A-012  | An owner proposing a transfer to an existing member creates a pending-transfer record; `gyms.owner_user_id` is unchanged until acceptance.                     | Integration test: propose transfer, assert pending row exists and `owner_user_id` unchanged.                   |
| A-013  | Proposing a transfer to a non-member returns an error and no pending record is created.                                                                        | Integration test: call propose RPC with non-member target, expect error, pending table empty.                  |
| A-013a | The target member accepting a pending transfer atomically flips `gyms.owner_user_id` and clears the pending record.                                            | Integration test: accept as target, assert `owner_user_id` = target and pending row removed.                   |
| A-013b | Declining (by target) or cancelling (by proposer) clears the pending record without changing `owner_user_id`.                                                  | Integration test: exercise decline and cancel paths, assert state.                                             |
| A-013c | A second propose supersedes the first: only one pending row exists per `gym_id` at any time.                                                                   | Integration test: propose twice, assert row count = 1 and target matches latest.                               |
| A-014  | An owner can generate an invite token, which is stored in `gym_invitations` with a unique opaque token and an `expires_at`.                                    | Integration test: generate invite, select row, assert token length ≥ 24 chars and `expires_at > now()`.        |
| A-015  | An authenticated non-member can redeem a valid invite and is added to `gym_members`; `uses_count` increments by one.                                           | Integration test: redeem as other user, expect new `gym_members` row and `uses_count` += 1.                    |
| A-016  | Redeeming an expired invite returns a distinct "expired" error and does not add a `gym_members` row.                                                           | Integration test: manually expire, attempt redeem, expect specific error code, zero new members.               |
| A-017  | Redeeming an invite whose `uses_count >= max_uses` returns a distinct "exhausted" error.                                                                       | Integration test: redeem to quota, attempt one more, expect specific error code.                               |
| A-018  | Only the gym owner can SELECT invites for their gym (RLS).                                                                                                     | Integration test: sign in as member, query `gym_invitations` for that gym, expect zero rows.                   |
| A-019  | The browse-list member count on the profile page reflects the actual `gym_members` row count per gym (no `--` placeholder).                                    | Playwright E2E: seed two gyms with 1 and 3 members respectively, assert rendered counts are "1" and "3".       |
| A-020  | A user with zero gym memberships can load the profile page and the broadcast surfaces without uncaught errors.                                                 | Playwright E2E: create fresh user, sign in, visit profile and display-picker, assert empty states render.      |
| A-021  | Every new mutation hook in `use-gyms.ts` / `use-gym-members.ts` / `use-gym-invites.ts` has an `onError` handler with `[gyms]` or `[gym-invites]` prefixed log. | Source inspection / unit test stubs firing mutation errors and asserting console.error call.                   |

## Dependencies

- **Feature 018 (Gym-Scoped Displays)** — defines the `gyms` and
  `gym_members` tables, the RLS baseline, and the display-broadcast
  contract this feature leaves intact.
- **Feature 010 (QR Code Gen/Scan)** — reused for invite QR display.
- **Feature 015 (Onboarding)** — no modification required, but smoke-tested
  against the new zero-gym state.
- Supabase migrations must run before the frontend ships the new routes
  and UI (standard deploy order).

## Open Questions

All Phase 1 open questions resolved:

- Invite defaults: **7 days / 10 uses**, owner-overridable.
- "Home" gym: **kept as-is**, not renamed, not deleted.
- Ownership transfer: **two-step** (propose → accept).
- Detail route: **`/profile/gyms/$gymId`** (nested under profile).
- Invite-redemption analytics: **skipped for v1** (Won't Have).

Remaining unknowns deferred to Tech phase:

- [ ] Exact schema shape for the pending-transfer record: dedicated
      `gym_ownership_transfers` table vs. nullable columns on `gyms`?
- [ ] Whether to surface pending-transfer notifications outside the gym
      detail page (e.g., a profile-level banner).

## Revision History

| Date       | Change       | ADR |
| ---------- | ------------ | --- |
| 2026-04-08 | Initial spec | —   |
