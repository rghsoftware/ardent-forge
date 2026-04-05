import { useSyncExternalStore, useCallback } from 'react'

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 *
 * Uses `useSyncExternalStore` instead of `useState` + `useEffect` to avoid
 * tearing in concurrent mode (the value stays consistent within a single render).
 *
 * `getServerSnapshot` returns `false` as a safe default for SSR/pre-hydration,
 * ensuring the hook never calls `window.matchMedia` on the server.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', callback)
      return () => mql.removeEventListener('change', callback)
    },
    [query],
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
