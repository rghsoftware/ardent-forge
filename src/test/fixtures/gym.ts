import { gymSchema, type Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// Gym test fixture (P15-053)
//
// Constructing `Gym` literals directly via object spread creates a parallel
// "trusted shape" that diverges from the production path through
// `gymSchema.parse`. A fixture that passes (say) a string where a UUID is
// expected will silently pass in tests but fail at runtime when real data
// flows through the same schema.
//
// `makeGym` runs every constructed fixture through `gymSchema.parse` so
// test inputs are validated identically to production data. If the schema
// ever gains a new required field, fixtures using stale shapes will fail
// loudly at test time rather than masking the issue.
//
// Timestamps use the `+00:00` offset form to mirror Postgres `timestamptz`
// output; the domain `isoDateTime` schema is `{ offset: true }` so both
// `Z` and `+HH:MM` are valid.
// ---------------------------------------------------------------------------

const DEFAULTS: Gym = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Gym',
  ownerUserId: '00000000-0000-0000-0000-000000000002',
  createdAt: '2026-01-01T00:00:00.000+00:00',
  updatedAt: '2026-01-01T00:00:00.000+00:00',
}

/**
 * Build a test `Gym` from a partial override, validated through
 * `gymSchema.parse`. Any field the caller omits falls back to a stable
 * default; any field that violates the schema will throw at fixture
 * construction time rather than being silently accepted.
 */
export function makeGym(overrides: Partial<Gym> = {}): Gym {
  return gymSchema.parse({ ...DEFAULTS, ...overrides })
}
