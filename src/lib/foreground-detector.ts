import { isTauri } from '@tauri-apps/api/core'

/**
 * Platform-agnostic foreground/background detection.
 *
 * Call `start()` to begin listening for visibility changes, and `stop()`
 * to tear down listeners. The detector itself has no knowledge of what
 * the callbacks do -- it simply fires them on transitions.
 */
export interface ForegroundDetector {
  /** Register platform event listeners. */
  start(): void
  /** Remove all registered event listeners (idempotent). */
  stop(): void
}

/**
 * Creates a ForegroundDetector that calls `onForeground` when the app
 * becomes visible/focused and `onBackground` when it is hidden/blurred.
 *
 * - **Browser mode**: listens to `document.visibilitychange`.
 * - **Tauri mode**: uses `getCurrentWindow().onFocusChanged()` from the
 *   Tauri v2 window API.  If the API is unavailable at runtime the
 *   detector falls back to `visibilitychange` for both platforms.
 */
export function createForegroundDetector(
  onForeground: () => void,
  onBackground: () => void,
): ForegroundDetector {
  if (isTauri()) {
    return createTauriDetector(onForeground, onBackground)
  }
  return createBrowserDetector(onForeground, onBackground)
}

// ---------------------------------------------------------------------------
// Browser implementation -- document.visibilitychange
// ---------------------------------------------------------------------------

function createBrowserDetector(
  onForeground: () => void,
  onBackground: () => void,
): ForegroundDetector {
  const handler = () => {
    if (document.hidden) {
      onBackground()
    } else {
      onForeground()
    }
  }

  let listening = false

  return {
    start() {
      if (listening) return
      listening = true
      document.addEventListener('visibilitychange', handler)
    },
    stop() {
      if (!listening) return
      listening = false
      document.removeEventListener('visibilitychange', handler)
    },
  }
}

// ---------------------------------------------------------------------------
// Tauri implementation -- window focus via @tauri-apps/api/window
// ---------------------------------------------------------------------------

function createTauriDetector(
  onForeground: () => void,
  onBackground: () => void,
): ForegroundDetector {
  // The Tauri unlisten function is obtained asynchronously, so we store
  // a reference that `stop()` can call later.
  let unlisten: (() => void) | null = null
  let listening = false
  // Track whether we fell back to the browser listener so `stop()` knows
  // which cleanup path to take.
  let fallback: ForegroundDetector | null = null

  return {
    start() {
      if (listening) return
      listening = true

      // Dynamic import so the Tauri window module is never bundled for
      // pure-browser builds (it would fail to resolve at build time).
      import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => {
          // Guard: stop() may have been called before the dynamic import
          // resolved.  Bail out so we don't leak a listener.
          if (!listening) return

          return getCurrentWindow()
            .onFocusChanged(({ payload: focused }) => {
              if (focused) {
                onForeground()
              } else {
                onBackground()
              }
            })
            .then((unlistenFn) => {
              // Another guard -- stop() could have raced the promise.
              if (!listening) {
                unlistenFn()
                return
              }
              unlisten = unlistenFn
            })
        })
        .catch(() => {
          // If the Tauri window API is unavailable (e.g. older Tauri
          // version or stripped plugin), fall back to visibilitychange.
          if (!listening) return
          fallback = createBrowserDetector(onForeground, onBackground)
          fallback.start()
        })
    },

    stop() {
      if (!listening) return
      listening = false

      if (unlisten) {
        unlisten()
        unlisten = null
      }

      if (fallback) {
        fallback.stop()
        fallback = null
      }
    },
  }
}
