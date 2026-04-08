// ---------------------------------------------------------------------------
// gym-error-messages.ts -- Postgres/PostgREST error → user-facing message
//
// Extracted from `src/components/profile/gym-management-section.tsx`
// (originally introduced in F018 P14-041) so the helper can be imported by
// both the gym-management section and the F019 display setup / chooser
// components without a component-file → component-file import smell.
//
// Branches on Supabase/PostgREST error codes so the user gets actionable
// guidance instead of "Please try again." for failures that retry won't
// fix (RLS denial, name conflict, deleted row). Falls back to a generic
// network message when no code is present.
// ---------------------------------------------------------------------------

/**
 * Narrow type guard for PG/PostgREST error shapes. The Supabase client can
 * return errors as any of: a plain Error, a PostgrestError object, or a
 * bare `{ code, message }` shape — so this guard accepts anything that is
 * an object with either `code` or `message`.
 */
export function isPgError(err: unknown): err is { code?: string; message?: string } {
  return typeof err === 'object' && err !== null && ('code' in err || 'message' in err)
}

/**
 * Maps a Postgres/PostgREST error to a user-facing message keyed by the
 * gym-mutation action kind. The action verb is inlined into the message so
 * one helper covers create / join / leave / delete without stringly-typed
 * branching in call sites.
 */
export function gymErrorMessage(
  err: unknown,
  action: 'create' | 'join' | 'leave' | 'delete',
): string {
  if (!isPgError(err)) {
    return `Failed to ${action} gym. Check your connection and try again.`
  }
  switch (err.code) {
    case '23505': // unique_violation
      return action === 'create'
        ? 'A gym with this name already exists. Choose a different name.'
        : `Failed to ${action} gym -- duplicate constraint. Refresh and try again.`
    case '42501': // insufficient_privilege (RLS denied)
      return `You don't have permission to ${action} this gym.`
    case 'PGRST116': // PostgREST: no rows
      return `Failed to ${action} gym -- it may have been deleted. Refresh the list.`
    default:
      return `Failed to ${action} gym. Check your connection and try again.`
  }
}
