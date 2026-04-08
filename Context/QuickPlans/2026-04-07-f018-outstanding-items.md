# Quick Plan: F018 Outstanding Items

**Task:** Address the two non-blocking items surfaced by the F018 Wave 9 security audit.

**Goal:** Leave the branch in a clean, review-ready state before PR creation.

---

## Outstanding items

### 1. Security CONCERN -- missing revoke/grant execute on three security-definer functions

The S028 audit flagged that `is_gym_member`, `is_gym_owner`, and `enroll_new_user_in_default_gym` lack explicit execute-grant locking. Not exploitable today, but deviates from the house pattern established in `20260404000002_get_secret_function.sql` and `20260407000002_replace_idle_sessions_rpc.sql`.

**Fix:** new migration `supabase/migrations/20260407000003_lock_gym_helper_functions.sql`

```sql
-- is_gym_member / is_gym_owner: called from RLS policies (which evaluate as
-- the calling user's role), so authenticated needs EXECUTE.
revoke execute on function public.is_gym_member(uuid)    from public, anon;
revoke execute on function public.is_gym_owner(uuid)     from public, anon;
grant  execute on function public.is_gym_member(uuid)    to authenticated;
grant  execute on function public.is_gym_owner(uuid)     to authenticated;

-- enroll_new_user_in_default_gym: only the DB trigger needs to call this.
-- No user-facing role needs EXECUTE.
revoke execute on function public.enroll_new_user_in_default_gym() from public, anon, authenticated;
```

### 2. Stylistic inconsistency -- `set search_path` idiom

`enroll_new_user_in_default_gym` uses `set search_path = public` while the two RLS helpers use `set search_path = ''` with fully-qualified names. Both are safe. Include a `CREATE OR REPLACE` in the same migration to normalize to `set search_path = ''` with the trigger body fully qualifying all object references (`public.gyms`, `public.gym_members`).

### 3. S031 manual smoke test (operator action -- not automated)

The automated S030 checks passed. S031 requires an operator to:

1. Apply migrations to a dev DB snapshot (`bun supabase db reset` or `bun supabase db push`)
2. Read the Home gym UUID from the migration `raise notice` output in the migration log
3. Open `/display/gym/<uuid>` in a browser
4. On a phone: sign in, tap Start Workout, pick Home gym, confirm a set
5. Observe the TV updates (workout_snapshot event arrives)
6. Start a new workout with picker set to Private, confirm a set
7. Observe the TV does NOT update

This is a human-in-the-loop step; nothing to code.

---

## Approach

1. Write `supabase/migrations/20260407000003_lock_gym_helper_functions.sql` with the 6 revoke/grant lines plus a `CREATE OR REPLACE FUNCTION enroll_new_user_in_default_gym` that normalizes `set search_path = ''` and fully qualifies all references in the body.
2. Verify: `bunx tsc --noEmit -p tsconfig.app.json` clean; `bun run lint` clean; `bun run test` green.
3. Append S031 smoke test instructions to `Context/Features/018-Gym-Scoped-Displays/Steps.md` under a new "S031 checklist" section so the operator has a clear checklist.

---

## Verification

- `bun run build` succeeds
- `bun run test` still 2168/2168 (migration file doesn't affect TS tests)
- `grep "revoke execute.*is_gym_member\|revoke execute.*is_gym_owner\|revoke execute.*enroll_new"` returns hits in the new migration
- `bunx tsc` and `bun run lint` clean

---

## Risks

- **Migration checksum:** we are NOT editing the existing migrations, only adding a new one. No checksum risk.
- **`authenticated` grant on `is_gym_*`:** RLS policies call these functions in the security-definer context, but the outer policy still evaluates under the `authenticated` role. Postgres requires the invoking role to have EXECUTE on a security-definer function even though the function body runs as a different role. If `authenticated` is missing EXECUTE, the RLS policies would break at runtime. Granting to `authenticated` is correct.
- **`enroll_new_user_in_default_gym` body refactor:** normializing `set search_path = ''` requires changing `public.gyms` → `public.gyms` (already correct in the body) and verifying `public.gym_members`. Low risk since the body is simple.
