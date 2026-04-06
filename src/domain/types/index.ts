// Barrel export for all domain types.
//
// Conflict resolution notes:
// - exercise.ts re-exports `SyncableEntity` (type only) from units.ts.
//   To avoid "Ambiguous re-export", units.ts is listed first and exercise.ts
//   exports are handled via explicit named exports that omit SyncableEntity.
// - program.ts re-exports `sessionTypeSchema` and `SessionType` from session.ts.
//   To avoid "Ambiguous re-export", session.ts is listed first and program.ts
//   exports are listed explicitly, omitting the re-exported names.

export * from './units'
export * from './set-scheme'
export * from './session'
export * from './event'

// exercise.ts re-exports SyncableEntity from units.ts -- exclude it here to
// prevent ambiguous re-export since units.ts already covers it above.
export {
  exerciseCategorySchema,
  movementPatternSchema,
  muscleGroupSchema,
  equipmentSchema,
  muscleGroupSpecSchema,
  exerciseSchema,
} from './exercise'
export type {
  ExerciseCategory,
  MovementPattern,
  MuscleGroup,
  Equipment,
  MuscleGroupSpec,
  Exercise,
} from './exercise'

export * from './workout-log'
export * from './user'
export * from './notification'
export * from './sharing'
export * from './analytics'
export * from './conversation'
export * from './message'
export * from './media'

// display-snapshot.ts imports sessionTypeSchema from session.ts but does not
// re-export it, so a plain wildcard re-export is safe here.
export * from './display-snapshot'
export * from './onboarding'

// program.ts re-exports sessionTypeSchema and SessionType from session.ts.
// Exclude those names here to prevent ambiguous re-export errors.
export {
  programSourceSchema,
  programSchema,
  blockTypeSchema,
  blockSchema,
  blockWeekSchema,
  activityOverrideSchema,
  sessionOverridesSchema,
  scheduledSessionSchema,
  programActivationSchema,
  weekStatusValueSchema,
  weekStatusSchema,
} from './program'
export type {
  ProgramSource,
  Program,
  BlockType,
  Block,
  BlockWeek,
  ActivityOverride,
  SessionOverrides,
  ScheduledSession,
  ProgramActivation,
  WeekStatusValue,
  WeekStatus,
} from './program'
