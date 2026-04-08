/**
 * Routes that should never show a discovery dot.
 * - `/` is always considered visited (the entry point).
 * - `/comms` has its own unread indicator.
 * - `/display` is a stateless TV landing route that intentionally has no
 *   auth/store dependencies, so it cannot call markRouteVisited.
 */
export const SKIP_DISCOVERY_ROUTES = new Set(['/', '/comms', '/display'])
