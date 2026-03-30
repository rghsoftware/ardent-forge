import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Types matching the JSONB shape from get_shared_program RPC
// The RPC returns snake_case keys from row_to_json(). We accept both
// camelCase (in case of client-side remapping) and snake_case fields.
// ---------------------------------------------------------------------------

interface RpcProgram {
  id: string
  name: string
  description?: string | null
  source: string
  duration_weeks?: number | null
  is_public?: boolean
  created_at?: string
  updated_at?: string
}

interface RpcBlock {
  id: string
  program_id: string
  name: string
  ordinal: number
  duration_weeks: number
  block_type: string
}

interface RpcBlockWeek {
  id: string
  block_id: string
  week_number: number
}

interface RpcScheduledSession {
  id: string
  block_week_id: string
  day_of_week?: number | null
  day_label: string
  session_type: string
  session_template_id: string
  notes?: string | null
}

interface RpcActivity {
  id: string
  activity_group_id: string
  exercise_id: string
  set_scheme: Record<string, unknown>
  ordinal: number
  notes?: string | null
}

interface RpcActivityGroup {
  id: string
  session_template_id: string
  group_type: string
  ordinal: number
  rounds?: number | null
  rest_between_rounds?: { seconds: number } | null
  rest_between_activities?: { seconds: number } | null
}

interface RpcSessionTemplate {
  id: string
  name: string
  description?: string | null
  category: string
  scoring?: string
}

interface SharedProgramData {
  program: RpcProgram
  blocks: Array<{
    block: RpcBlock
    weeks: Array<{
      week: RpcBlockWeek
      sessions: RpcScheduledSession[]
    }>
  }>
  sessionTemplates: Array<{
    template: RpcSessionTemplate
    activityGroups: Array<{
      group: RpcActivityGroup
      activities: RpcActivity[]
    }>
  }>
}

const SOURCE_LABELS: Record<string, string> = {
  CUSTOM: 'CUSTOM',
  IMPORTED: 'IMPORTED',
  SHARED: 'SHARED',
  MARKETPLACE: 'MARKETPLACE',
  AI_GENERATED: 'AI',
  COACH_ASSIGNED: 'COACH',
  TEMPLATE: 'TEMPLATE',
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  ACCUMULATION: 'ACCUMULATION',
  INTENSIFICATION: 'INTENSIFICATION',
  REALIZATION: 'REALIZATION',
  DELOAD: 'DELOAD',
  TEST: 'TEST',
}

const DAY_LABELS: Record<number, string> = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
}

// ---------------------------------------------------------------------------
// Set scheme display helpers
// ---------------------------------------------------------------------------

function formatLoadSpec(load: Record<string, unknown>): string {
  switch (load.type) {
    case 'absolute': {
      const w = load.weight as { value: number; unit: string }
      return `${w.value}${w.unit}`
    }
    case 'percentageOf1RM':
      return `${Math.round((load.percentage as number) * 100)}% 1RM`
    case 'rpe':
      return `RPE ${load.target}`
    case 'percentMaxReps':
      return `${Math.round((load.percentage as number) * 100)}% max reps`
    case 'bodyweight':
      return 'BW'
    case 'bodyweightPlus': {
      const w = load.additionalWeight as { value: number; unit: string }
      return `BW + ${w.value}${w.unit}`
    }
    case 'unspecified':
      return '--'
    default:
      return '--'
  }
}

function formatNumberRange(val: unknown): string {
  if (typeof val === 'number') return String(val)
  if (val && typeof val === 'object' && 'min' in val && 'max' in val) {
    const r = val as { min: number; max: number }
    return `${r.min}-${r.max}`
  }
  return '--'
}

function formatSetScheme(scheme: Record<string, unknown>): string {
  switch (scheme.type) {
    case 'fixedSets': {
      const sets = formatNumberRange(scheme.sets)
      const reps = formatNumberRange(scheme.reps)
      const load = scheme.load ? formatLoadSpec(scheme.load as Record<string, unknown>) : ''
      const amrap = scheme.lastSetAMRAP ? ' (last set AMRAP)' : ''
      return `${sets} x ${reps}${load ? ` @ ${load}` : ''}${amrap}`
    }
    case 'percentageSets': {
      const pct = Math.round((scheme.percentageOf1RM as number) * 100)
      const amrap = scheme.lastSetAMRAP ? ' (last set AMRAP)' : ''
      return `${scheme.sets} x ${scheme.reps} @ ${pct}% 1RM${amrap}`
    }
    case 'workToMax': {
      const range = scheme.targetRepRange as { min: number; max: number }
      return `Work to ${range.min}-${range.max} RM`
    }
    case 'timedHold': {
      const dur = scheme.duration as { seconds: number }
      return `${scheme.sets} x ${dur.seconds}s hold`
    }
    case 'forReps': {
      const load = scheme.load ? ` @ ${formatLoadSpec(scheme.load as Record<string, unknown>)}` : ''
      return `${scheme.targetReps} reps${load}`
    }
    case 'cardioSteadyState': {
      const dur = scheme.duration as { seconds: number } | undefined
      const dist = scheme.distance as { value: number; unit: string } | undefined
      const parts: string[] = []
      if (dur) parts.push(`${Math.round(dur.seconds / 60)} min`)
      if (dist) parts.push(`${dist.value} ${dist.unit}`)
      return `${scheme.modality}: ${parts.join(' / ') || '--'}`
    }
    case 'cardioInterval': {
      const workDur = scheme.workDuration as { seconds: number } | undefined
      const workDist = scheme.workDistance as { value: number; unit: string } | undefined
      const rest = scheme.rest as { seconds: number }
      const work = workDur
        ? `${workDur.seconds}s`
        : workDist
          ? `${workDist.value} ${workDist.unit}`
          : '--'
      return `${scheme.rounds} x ${work} / ${rest.seconds}s rest (${scheme.modality})`
    }
    case 'ruckMarch': {
      const loadW = scheme.loadWeight as { value: number; unit: string }
      const dur = scheme.duration as { seconds: number } | undefined
      const dist = scheme.distance as { value: number; unit: string } | undefined
      const parts: string[] = [`${loadW.value}${loadW.unit}`]
      if (dur) parts.push(`${Math.round(dur.seconds / 60)} min`)
      if (dist) parts.push(`${dist.value} ${dist.unit}`)
      return `Ruck: ${parts.join(' / ')}`
    }
    case 'emom': {
      return `EMOM ${scheme.totalMinutes} min: ${scheme.repsPerMinute} reps/min`
    }
    case 'amrapTimed': {
      const cap = scheme.timeCap as { seconds: number }
      return `AMRAP ${Math.round(cap.seconds / 60)} min`
    }
    case 'descendingReps': {
      const ladder = scheme.repLadder as number[]
      return `Descending: ${ladder.join('-')}`
    }
    case 'percentageOfMaxReps': {
      const pct = Math.round((scheme.percentage as number) * 100)
      const sets = scheme.sets ? `${scheme.sets} x ` : ''
      return `${sets}${pct}% max reps`
    }
    default:
      return JSON.stringify(scheme)
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SharedProgramViewProps {
  data: SharedProgramData
}

export function SharedProgramView({ data }: SharedProgramViewProps) {
  const { program, blocks, sessionTemplates } = data

  // Build a lookup from template ID to template data
  const templateMap = new Map(sessionTemplates.map((st) => [st.template.id, st]))

  return (
    <div className="flex flex-col gap-6">
      {/* Program header */}
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-medium text-bone-white">{program.name}</h2>
        {program.description && <p className="text-sm text-warm-ash">{program.description}</p>}
        <div className="flex items-center gap-2">
          <Badge className="text-[11px]">{SOURCE_LABELS[program.source] ?? program.source}</Badge>
          {program.duration_weeks != null && program.duration_weeks > 0 && (
            <span className="text-[11px] uppercase tracking-wider text-warm-ash/60">
              {program.duration_weeks} {program.duration_weeks === 1 ? 'WEEK' : 'WEEKS'}
            </span>
          )}
        </div>
      </div>

      {/* Block structure */}
      {blocks.map(({ block, weeks }) => (
        <div key={block.id} className="flex flex-col gap-3">
          {/* Block header */}
          <div className="flex items-center gap-2 bg-surface-iron px-4 py-3">
            <span className="font-display text-sm font-medium text-bone-white">{block.name}</span>
            <Badge className="bg-surface-gunmetal text-bone-white text-[11px]">
              {BLOCK_TYPE_LABELS[block.block_type] ?? block.block_type}
            </Badge>
            <span className="text-[11px] uppercase tracking-wider text-warm-ash/60">
              {block.duration_weeks} {block.duration_weeks === 1 ? 'WK' : 'WKS'}
            </span>
          </div>

          {/* Weeks */}
          {weeks.map(({ week, sessions }) => (
            <div key={week.id} className="flex flex-col gap-2 pl-4">
              <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">
                WEEK {week.week_number}
              </span>

              {/* Sessions */}
              {sessions.length === 0 ? (
                <span className="text-xs text-warm-ash/40 italic pl-2">No sessions scheduled</span>
              ) : (
                sessions.map((session) => {
                  const tpl = templateMap.get(session.session_template_id)
                  return (
                    <div
                      key={session.id}
                      className="flex flex-col gap-2 bg-surface-charcoal px-3 py-3"
                    >
                      {/* Session header */}
                      <div className="flex items-center gap-2">
                        {session.day_of_week != null && (
                          <span className="text-[11px] font-medium uppercase tracking-widest text-ember">
                            {DAY_LABELS[session.day_of_week] ?? `DAY ${session.day_of_week}`}
                          </span>
                        )}
                        <span className="font-display text-sm text-bone-white">
                          {session.day_label}
                        </span>
                        <Badge className="bg-surface-gunmetal text-bone-white text-[11px]">
                          {session.session_type}
                        </Badge>
                      </div>

                      {session.notes && (
                        <p className="text-xs text-warm-ash/60 italic">{session.notes}</p>
                      )}

                      {/* Template detail */}
                      {tpl && (
                        <div className="flex flex-col gap-2">
                          {tpl.template.description && (
                            <p className="text-xs text-warm-ash/60">{tpl.template.description}</p>
                          )}
                          {/* Activity groups */}
                          {tpl.activityGroups.map(({ group, activities }) => (
                            <div key={group.id} className="flex flex-col gap-1">
                              {/* Group type header */}
                              <div className="flex items-center gap-2 py-1">
                                <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">
                                  {group.group_type.replace(/_/g, ' ')}
                                </span>
                                {group.rounds != null && group.rounds > 1 && (
                                  <span className="text-[11px] text-warm-ash/40">
                                    {group.rounds} rounds
                                  </span>
                                )}
                              </div>

                              {/* Activity table */}
                              <div className="w-full">
                                {/* Column headers */}
                                <div className="flex items-center py-1.5 border-b border-warm-ash/10">
                                  <span className="w-8 text-center text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
                                    #
                                  </span>
                                  <span className="flex-1 text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
                                    EXERCISE
                                  </span>
                                  <span className="flex-1 text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
                                    PRESCRIPTION
                                  </span>
                                </div>

                                {/* Activity rows */}
                                {activities
                                  .sort((a, b) => a.ordinal - b.ordinal)
                                  .map((activity, idx) => (
                                    <div
                                      key={activity.id}
                                      className={`flex items-center py-2 ${
                                        idx % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal'
                                      }`}
                                    >
                                      <span className="w-8 text-center font-display text-sm tabular-nums text-bone-white">
                                        {activity.ordinal}
                                      </span>
                                      <span className="flex-1 text-sm text-bone-white truncate pr-2">
                                        {activity.exercise_id.slice(0, 8)}...
                                      </span>
                                      <span className="flex-1 text-sm tabular-nums text-warm-ash">
                                        {formatSetScheme(activity.set_scheme)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
