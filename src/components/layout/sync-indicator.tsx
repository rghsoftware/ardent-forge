import { Icon } from '@/components/icon'
import { useSyncStore } from '@/stores/sync-store'
import { forcePush } from '@/lib/sync-bridge'
import { isTauri } from '@tauri-apps/api/core'

export function SyncIndicator() {
  const { syncState, errorMessage } = useSyncStore()

  if (!isTauri()) return null
  if (syncState === 'offline') return null

  const handleErrorTap = () => {
    forcePush().catch(console.error)
  }

  return (
    <div className="flex items-center justify-center min-w-[48px] min-h-[48px]">
      {syncState === 'syncing' && (
        <span aria-label="Syncing">
          <Icon name="sync" size={20} className="text-ember animate-spin" />
        </span>
      )}
      {syncState === 'synced' && (
        <span aria-label="Synced">
          <Icon name="cloud_done" size={20} className="text-quenched" />
        </span>
      )}
      {syncState === 'error' && (
        <button
          onClick={handleErrorTap}
          className="flex items-center justify-center min-w-[48px] min-h-[48px]"
          aria-label="Sync error - tap to retry"
          title={errorMessage ?? 'Sync failed'}
        >
          <Icon name="cloud_off" size={20} className="text-warning-flare" />
        </button>
      )}
    </div>
  )
}
