// src/lib/override-merger.ts
// Pure function that merges per-instance session overrides into resolved
// template groups (PrefilledGroup[]). Used between resolveSessionTemplate()
// and workout log persistence to "bake in" user customizations.

import type { SessionOverrides, OneRepMax, Activity } from '@/domain/types'
import type { PrefilledGroup } from '@/lib/prescription-resolver'
import { resolveSetsForActivity } from '@/lib/prescription-resolver'

/**
 * Context needed to re-resolve sets when a setScheme override is applied.
 * These are the same dependencies that resolveSessionTemplate uses.
 */
export type ResolutionContext = {
  exerciseMaxes: Record<string, OneRepMax>
  maxReps: Record<string, number>
  preferredUnit: 'lb' | 'kg'
}

/**
 * Apply per-instance overrides to resolved template groups.
 * Walks resolved groups, matches activities by original activity ID
 * (templateActivityId), and swaps exerciseId and/or setScheme when
 * an override exists.
 *
 * - No-op when overrides is null/undefined/empty
 * - Silently skips orphaned override keys (activity deleted from template)
 * - Returns a new array (does not mutate input)
 *
 * @param prefilledGroups - Output of resolveSessionTemplate()
 * @param overrides - Per-instance overrides from ScheduledSession.overrides
 * @param resolutionCtx - Required when overrides contain setScheme swaps;
 *   can be omitted if only exerciseId overrides are expected.
 */
export function applyOverrides(
  prefilledGroups: PrefilledGroup[],
  overrides: SessionOverrides | null | undefined,
  resolutionCtx?: ResolutionContext,
): PrefilledGroup[] {
  // Early return: nothing to override
  if (!overrides?.activityOverrides) return prefilledGroups
  const activityOverrides = overrides.activityOverrides
  if (Object.keys(activityOverrides).length === 0) return prefilledGroups

  return prefilledGroups.map((group) => {
    // Check if any activity in this group has an override before cloning
    const hasOverride = group.activities.some(
      (pa) => activityOverrides[pa.templateActivityId] != null,
    )
    if (!hasOverride) return group

    return {
      ...group,
      activities: group.activities.map((pa) => {
        const override = activityOverrides[pa.templateActivityId]
        if (!override) return pa

        const newActivity = { ...pa, activity: { ...pa.activity } }

        // Swap exerciseId if overridden
        if (override.exerciseId) {
          newActivity.activity.exerciseId = override.exerciseId
        }

        // Re-resolve sets if setScheme is overridden
        if (override.setScheme && resolutionCtx) {
          const effectiveExerciseId = newActivity.activity.exerciseId
          // Build a synthetic Activity to feed into the set resolver
          const syntheticActivity: Activity = {
            id: pa.templateActivityId,
            activityGroupId: '', // not used by resolveSetsForActivity
            exerciseId: effectiveExerciseId,
            setScheme: override.setScheme,
            ordinal: pa.activity.ordinal,
          }
          try {
            newActivity.sets = resolveSetsForActivity(
              syntheticActivity,
              resolutionCtx.exerciseMaxes,
              resolutionCtx.maxReps,
              resolutionCtx.preferredUnit,
            )
          } catch (err) {
            console.error(
              '[override-merger] Failed to re-resolve sets for activity',
              pa.templateActivityId,
              ':',
              err,
            )
            // Keep original sets on resolution failure
          }
        }

        return newActivity
      }),
    }
  })
}
