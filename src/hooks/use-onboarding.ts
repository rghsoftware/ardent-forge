import { useAuth } from '@/lib/auth'
import { useOnboardingStore } from '@/stores/onboarding-store'

export function useOnboarding() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const initialize = useOnboardingStore((s) => s.initialize)
  const welcomeDismissed = useOnboardingStore((s) => s.welcomeDismissed)
  const hintsSeenKeys = useOnboardingStore((s) => s.hintsSeenKeys)
  const visitedRoutes = useOnboardingStore((s) => s.visitedRoutes)
  const dismissWelcome = useOnboardingStore((s) => s.dismissWelcome)
  const markHintSeen = useOnboardingStore((s) => s.markHintSeen)
  const markRouteVisited = useOnboardingStore((s) => s.markRouteVisited)
  const markFirstWorkoutCompleted = useOnboardingStore((s) => s.markFirstWorkoutCompleted)
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding)

  initialize(userId)

  return {
    isFirstRun: !welcomeDismissed,
    shouldShowHint: (key: string) => !hintsSeenKeys.includes(key),
    hasVisited: (route: string) => visitedRoutes.includes(route),
    dismissWelcome,
    markHintSeen,
    markRouteVisited,
    markFirstWorkoutCompleted,
    resetOnboarding,
  }
}
