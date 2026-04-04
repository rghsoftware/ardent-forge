import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { idleSnapshotSchema } from '@/domain/types'
import type { IdleSnapshot } from '@/domain/types'

/**
 * Subscribes to the `display` Broadcast channel and returns the most recent
 * valid `IdleSnapshot`, or `null` if none has been received yet.
 *
 * - Filters for `event === 'idle_snapshot'` only
 * - Validates each payload with `idleSnapshotSchema.safeParse()` and silently
 *   discards anything that fails validation
 * - Cleans up the channel subscription on unmount (A-013)
 */
export function useIdleSnapshot(): IdleSnapshot | null {
  const [snapshot, setSnapshot] = useState<IdleSnapshot | null>(null)

  useEffect(() => {
    const client = getSupabaseClient()
    if (!client) return

    const channel = client
      .channel('display')
      .on('broadcast', { event: 'idle_snapshot' }, (payload) => {
        const parsed = idleSnapshotSchema.safeParse(payload.payload)
        if (parsed.success) {
          setSnapshot(parsed.data)
        }
      })
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [])

  return snapshot
}
