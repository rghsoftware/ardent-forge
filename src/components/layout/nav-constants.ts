/** Routes that should never show a discovery dot (home is always "visited", comms has its own unread indicator). */
export const SKIP_DISCOVERY_ROUTES = new Set(['/', '/comms'])
