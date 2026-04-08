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
 * P15-033: Exported alias for the gym mutation action kinds so consumers
 * (gym-management-section, display-setup-panel, display-chooser) can type
 * their handlers without duplicating the literal union.
 */
export type GymMutationAction = 'create' | 'join' | 'leave' | 'delete'

/**
 * P15-037: Narrow type guard for PG/PostgREST error shapes. Accepts any
 * object that has SHAPE-like error metadata (either a `code` or a
 * `message` field). Historically named `isPgError` but really means
 * "has an error-like object shape"; keep the name for call-site
 * compatibility and clarify in the JSDoc.
 */
export function isPgError(err: unknown): err is { code?: string; message?: string } {
  return typeof err === 'object' && err !== null && ('code' in err || 'message' in err)
}

/**
 * P15-038: Known gym-mutation Postgres/PostgREST error codes. Declared as
 * a `const` tuple so adding a new mapping forces an exhaustive review in
 * the switch below (via the narrowed `PgGymCode` type).
 */
export const PG_GYM_CODES = ['23505', '42501', 'PGRST116'] as const

/**
 * Maps a Postgres/PostgREST error to a user-facing message keyed by the
 * gym-mutation action kind. The action verb is inlined into the message so
 * one helper covers create / join / leave / delete without stringly-typed
 * branching in call sites.
 */
export function gymErrorMessage(err: unknown, action: GymMutationAction): string {
  if (!isPgError(err)) {
    return `Failed to ${action} gym. Check your connection and try again.`
  }
  const code = err.code
  switch (code) {
    case '23505': // unique_violation
      return action === 'create'
        ? 'A gym with this name already exists. Choose a different name.'
        : `Failed to ${action} gym -- duplicate constraint. Refresh and try again.`
    case '42501': // insufficient_privilege (RLS denied)
      return `You don't have permission to ${action} this gym.`
    case 'PGRST116': // PostgREST: no rows
      return `Failed to ${action} gym -- it may have been deleted. Refresh the list.`
    default:
      // P15-039: warn when the PG-code fallback fires so operators get a
      // signal when new codes start appearing (schema drift, new RLS
      // policy errors, Supabase error type changes). Safety-net coercions
      // at a boundary should be observable per .claude/rules/error-handling.md.
      console.warn(`[gym-error-messages] Unmapped PG code for ${action}:`, code ?? '(no code)', err)
      return `Failed to ${action} gym. Check your connection and try again.`
  }
}
