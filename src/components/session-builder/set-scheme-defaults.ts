import type { SetScheme } from '@/domain/types'

type SetSchemeType = SetScheme['type']

export function defaultScheme(type: SetSchemeType): SetScheme {
  switch (type) {
    case 'fixedSets':
      return {
        type: 'fixedSets',
        sets: 3,
        reps: 10,
        load: { type: 'unspecified' },
      }
    case 'percentageSets':
      return {
        type: 'percentageSets',
        sets: 3,
        reps: 5,
        percentageOf1RM: 0.75,
      }
    case 'workToMax':
      return { type: 'workToMax', targetRepRange: { min: 1, max: 3 } }
    case 'timedHold':
      return {
        type: 'timedHold',
        duration: { seconds: 30 },
        sets: 3,
      }
    case 'forReps':
      return { type: 'forReps', targetReps: 50 }
    case 'cardioSteadyState':
      return {
        type: 'cardioSteadyState',
        duration: { seconds: 1800 },
        modality: 'RUNNING',
      }
    case 'cardioInterval':
      return {
        type: 'cardioInterval',
        workDuration: { seconds: 30 },
        rest: { seconds: 60 },
        rounds: 10,
        modality: 'RUNNING',
      }
    case 'ruckMarch':
      return {
        type: 'ruckMarch',
        loadWeight: { value: 35, unit: 'lb' },
        duration: { seconds: 3600 },
        modality: 'RUCKING',
      }
    case 'emom':
      return { type: 'emom', repsPerMinute: 10, totalMinutes: 10 }
    case 'amrapTimed':
      return { type: 'amrapTimed', timeCap: { seconds: 600 } }
    case 'descendingReps':
      return { type: 'descendingReps', repLadder: [10, 8, 6, 4, 2] }
    case 'percentageOfMaxReps':
      return { type: 'percentageOfMaxReps', percentage: 0.5 }
  }
}
