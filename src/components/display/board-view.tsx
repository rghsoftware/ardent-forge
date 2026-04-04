import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useDisplayStore, getPageSessions, getTotalPages } from '@/stores/display-store'
import { SessionCard } from '@/components/display/session-card'
import { PageIndicator } from '@/components/display/page-indicator'

const PAGE_CYCLE_MS = 10_000

function BoardView() {
  const sessions = useDisplayStore(getPageSessions)
  const totalPages = useDisplayStore(getTotalPages)
  const currentPage = useDisplayStore((s) => s.currentPage)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-cycle pages when there are multiple
  useEffect(() => {
    if (totalPages <= 1) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      const state = useDisplayStore.getState()
      const total = getTotalPages(state)
      const next = (state.currentPage + 1) % total
      state.setCurrentPage(next)
    }, PAGE_CYCLE_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [totalPages])

  const count = sessions.length

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      <div
        className={cn(
          'grid flex-1 gap-4 p-4',
          count === 1 && 'grid-cols-1 place-items-center',
          count === 2 && 'grid-cols-2',
          count >= 3 && 'grid-cols-2 grid-rows-2',
        )}
      >
        {sessions.map((snapshot) => (
          <div key={snapshot.user_id} className={cn('h-full w-full', count === 1 && 'max-w-[60%]')}>
            <SessionCard snapshot={snapshot} />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="py-2">
          <PageIndicator totalPages={totalPages} currentPage={currentPage} />
        </div>
      )}
    </div>
  )
}

export { BoardView }
