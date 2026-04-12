import type { ActivityGroupData } from './activity-group-editor'

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

export interface GroupValidationErrors {
  noType?: string
  noActivities?: string
}

export interface ValidationErrors {
  name?: string
  noGroups?: string
  groups: Record<string, GroupValidationErrors>
  activities: Record<string, string>
}

// ---------------------------------------------------------------------------
// Pure validation function (exported for unit testing)
// ---------------------------------------------------------------------------

export function computeErrors(name: string, groups: ActivityGroupData[]): ValidationErrors {
  const errs: ValidationErrors = { groups: {}, activities: {} }
  if (!name.trim()) errs.name = 'Give your template a name'
  if (groups.length === 0) errs.noGroups = 'Add at least one group to continue'
  for (const g of groups) {
    const ge: GroupValidationErrors = {}
    if (!g.groupType) ge.noType = 'Pick a group type'
    if (g.activities.length === 0) ge.noActivities = 'Add at least one exercise'
    if (ge.noType || ge.noActivities) errs.groups[g.clientId] = ge
    for (const a of g.activities) {
      if (!a.exerciseId) errs.activities[a.clientId] = 'Select an exercise'
    }
  }
  return errs
}
