/**
 * Recent note-tags store (F020).
 *
 * Local-only Zustand store that remembers the most recently used note tags
 * for the in-workout and manual-form tag pickers. Backed by localStorage
 * directly (per ADR-010: localStorage over persist middleware).
 *
 * Capped at 20 entries. `markUsed` normalizes input, dedupes
 * case-insensitively, and moves the touched tag to the front.
 */
import { create } from 'zustand'
import { normalizeTag } from '@/domain/types'

const STORAGE_KEY = 'recent-note-tags'
const MAX_RECENT = 20

interface RecentTagsState {
  recent: string[]
}

interface RecentTagsActions {
  markUsed: (tag: string) => void
  clear: () => void
}

function loadRecent(): string[] {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return []
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      console.warn('[recent-tags] Stored value is not an array, resetting')
      return []
    }
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT)
  } catch (err) {
    console.error('[recent-tags] Failed to load recent tags:', err)
    return []
  }
}

function persistRecent(recent: string[]): void {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') {
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
  } catch (err) {
    console.error('[recent-tags] Failed to persist recent tags:', err)
  }
}

export const useRecentTagsStore = create<RecentTagsState & RecentTagsActions>((set, get) => ({
  recent: loadRecent(),

  markUsed: (tag: string) => {
    const normalized = normalizeTag(tag)
    if (!normalized) {
      console.warn('[recent-tags] markUsed ignored empty tag after normalization')
      return
    }
    const current = get().recent
    // Dedupe case-insensitively (normalizeTag already uppercases, so strict eq suffices)
    const filtered = current.filter((t) => t !== normalized)
    const next = [normalized, ...filtered].slice(0, MAX_RECENT)
    persistRecent(next)
    set({ recent: next })
  },

  clear: () => {
    persistRecent([])
    set({ recent: [] })
  },
}))
