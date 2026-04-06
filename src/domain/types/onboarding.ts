/**
 * Domain union types for onboarding hint keys and tracked routes.
 * Using unions instead of `string` ensures typos like `markHintSeen("libary-intro")`
 * cause compile errors instead of silent failures.
 */

export type OnboardingHintKey =
  | 'library-intro'
  | 'vault-intro'
  | 'builder-intro'
  | 'profile-display-name'
  | 'workout-add-exercise'
  | 'workout-first-set'
  | 'workout-complete-celebration'

export type OnboardingRoute =
  | '/'
  | '/library'
  | '/vault'
  | '/builder'
  | '/history'
  | '/exercises'
  | '/connections'
  | '/groups'
