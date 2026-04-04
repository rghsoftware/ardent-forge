import { cn } from '@/lib/utils'
import { useDisplayStore, getDisplayMode } from '@/stores/display-store'

function ConnectionFooter() {
  const connectionStatus = useDisplayStore((s) => s.connectionStatus)
  const displayMode = useDisplayStore(getDisplayMode)
  const sessions = useDisplayStore((s) => s.sessions)
  const focusedUserId = useDisplayStore((s) => s.focusedUserId)

  // Resolve the focused user's display name from their snapshot
  const focusedName =
    focusedUserId != null ? (sessions.get(focusedUserId)?.display_name ?? 'Unknown') : null

  const sessionCount = sessions.size

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 flex h-12 items-center justify-between bg-surface-pit px-6">
      {/* Left: connection indicator */}
      <div className="flex items-center gap-2">
        <span
          className={cn('inline-block h-2 w-2 rounded-full', {
            'bg-arc': connectionStatus === 'connected',
            'bg-amber-500 animate-pulse': connectionStatus === 'reconnecting',
            'bg-oxidized-edge': connectionStatus === 'disconnected',
          })}
        />
        <span className="text-sm text-warm-ash">
          {connectionStatus === 'connected' && 'Connected'}
          {connectionStatus === 'reconnecting' && 'Reconnecting...'}
          {connectionStatus === 'disconnected' && 'Disconnected'}
        </span>
      </div>

      {/* Right: context info */}
      <div className="text-sm text-warm-ash">
        {displayMode === 'board' && (
          <span>
            {sessionCount} active {sessionCount === 1 ? 'session' : 'sessions'}
          </span>
        )}
        {displayMode === 'focused' && focusedName != null && <span>Focused: {focusedName}</span>}
      </div>
    </footer>
  )
}

export { ConnectionFooter }
