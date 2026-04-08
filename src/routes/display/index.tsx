import { createFileRoute } from '@tanstack/react-router'
import { DisplayDispatcher } from '@/components/display/display-dispatcher'

// ---------------------------------------------------------------------------
// /display route -- thin wrapper around <DisplayDispatcher /> (F019 D14, M6)
//
// All branching for the dispatcher (auth state → loading / unauthenticated /
// zero / single / many) lives in `DisplayDispatcher`, not here. The route
// file deliberately stays a 5-line shell so it can be tested by mounting
// `<DisplayDispatcher />` directly without a router harness for unit tests.
//
// Unauthenticated visitors continue to see the legacy "DISPLAY NOT
// CONFIGURED" copy via the dispatcher's `unauthenticated` branch (Spec.md
// M20 / TA17). The dumb-TV route at `/display/gym/$gymId` is unchanged.
//
// `/display` remains in `SKIP_DISCOVERY_ROUTES` (already set in d942080).
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/display/')({
  component: DisplayDispatcherRoute,
})

function DisplayDispatcherRoute() {
  return <DisplayDispatcher />
}
