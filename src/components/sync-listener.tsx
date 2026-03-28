import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isTauri } from '@tauri-apps/api/core'
import { onDataChanged, onSyncStateChanged, mapRustStateToUi } from '@/lib/sync-bridge'
import { useSyncStore } from '@/stores/sync-store'

/**
 * Invisible component that subscribes to Tauri sync engine events and
 * updates the SyncStore + invalidates TanStack Query caches when remote
 * data changes arrive. Renders nothing; must be mounted inside
 * QueryClientProvider.
 */
export function SyncListener() {
  const queryClient = useQueryClient()
  const setSyncState = useSyncStore((s) => s.setSyncState)

  useEffect(() => {
    if (!isTauri()) return

    let unlistenState: (() => void) | undefined
    let unlistenData: (() => void) | undefined

    onSyncStateChanged((state) => {
      setSyncState(mapRustStateToUi(state), state.type === 'Error' ? state.message : null)
    })
      .then((fn) => {
        unlistenState = fn
      })
      .catch((err) => {
        console.error('[sync-listener] Failed to register state listener:', err)
      })

    onDataChanged((data) => {
      queryClient.invalidateQueries({ queryKey: [data.table] })
    })
      .then((fn) => {
        unlistenData = fn
      })
      .catch((err) => {
        console.error('[sync-listener] Failed to register data listener:', err)
      })

    return () => {
      unlistenState?.()
      unlistenData?.()
    }
  }, [queryClient, setSyncState])

  return null
}
