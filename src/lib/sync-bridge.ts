import { isTauri } from '@tauri-apps/api/core'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export type SyncStateType = 'offline' | 'syncing' | 'synced' | 'error'

export type SyncStateChanged =
  | { type: 'Offline' }
  | { type: 'Pushing' }
  | { type: 'Pulling' }
  | { type: 'Idle' }
  | { type: 'Error'; message: string }

export interface DataChanged {
  table: string
  id: string
}

export function mapRustStateToUi(rustState: SyncStateChanged): SyncStateType {
  switch (rustState.type) {
    case 'Pushing':
    case 'Pulling':
      return 'syncing'
    case 'Idle':
      return 'synced'
    case 'Error':
      return 'error'
    case 'Offline':
      return 'offline'
  }
}

export async function initSync(
  accessToken: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<void> {
  if (!isTauri()) return
  await invoke('sync_set_auth', { accessToken, supabaseUrl, supabaseKey })
}

export async function stopSync(): Promise<void> {
  if (!isTauri()) return
  await invoke('sync_clear_auth')
}

export async function forcePush(): Promise<void> {
  if (!isTauri()) return
  await invoke('sync_force_push')
}

export async function forcePull(): Promise<void> {
  if (!isTauri()) return
  await invoke('sync_force_pull')
}

export async function getSyncStatus(): Promise<SyncStateChanged | null> {
  if (!isTauri()) return null
  const statusJson = await invoke<string>('sync_get_status')
  try {
    return JSON.parse(statusJson) as SyncStateChanged
  } catch (err) {
    console.error('[sync] Failed to parse sync status:', statusJson, err)
    return null
  }
}

export function onSyncStateChanged(
  callback: (state: SyncStateChanged) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return Promise.resolve(() => {})
  return listen<SyncStateChanged>('sync:state_changed', (event) => {
    callback(event.payload)
  })
}

export function onDataChanged(callback: (data: DataChanged) => void): Promise<UnlistenFn> {
  if (!isTauri()) return Promise.resolve(() => {})
  return listen<DataChanged>('sync:data_changed', (event) => {
    callback(event.payload)
  })
}
