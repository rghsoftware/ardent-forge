import { useCallback, useEffect, useRef, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'

// ---------------------------------------------------------------------------
// useQrScanner -- Tauri barcode scanner hook (F019 D12)
//
// Extracted from `src/routes/setup.tsx:163-209` so F019's Display Setup
// panel can reuse the same permission + scanner lifecycle without
// duplicating the Tauri plugin import path.
//
// Returns `null` outside Tauri so callers can trivially hide scan UI:
//
//   const scanner = useQrScanner()
//   // ...
//   {scanner && <button onClick={scanner.scan}>Scan QR</button>}
//
// `isTauri()` is a stable value for the lifetime of the app session, so
// the early return never changes order across renders — Rules of Hooks
// are honored because every hook call above the return runs on every
// render regardless of the return value.
//
// Behavior notes:
//   - The webview is made transparent while scanning (via the
//     `scanner-active` class on `<html>` and transparent body bg) so the
//     native camera feed rendered behind it becomes visible.
//   - Permission prompts are handled inline: if status is 'prompt' we
//     request permissions, and if the user denies we forward them to
//     the app settings via `openAppSettings()`.
//   - `scan()` resolves with the decoded content string on success,
//     or `null` on user cancel / permission denial / failure. Errors
//     during the scan itself are logged with the `[qr-scanner]` prefix
//     per `.claude/rules/error-handling.md`.
// ---------------------------------------------------------------------------

export interface UseQrScannerResult {
  /** True while a scan is in flight. Callers render a cancel affordance from this. */
  scanning: boolean
  /** Opens the native scanner. Resolves with the decoded content or null. */
  scan: () => Promise<string | null>
  /** Cancels an in-flight scan. Safe to call when not scanning. */
  cancel: () => Promise<void>
}

export function useQrScanner(): UseQrScannerResult | null {
  const [scanning, setScanning] = useState(false)
  const cancelRef = useRef<(() => Promise<void>) | null>(null)

  // Background transparency is driven from the `scanning` state so that
  // if the caller unmounts mid-scan, React cleanup still runs and the
  // body does not stay transparent. The `scanner-active` class, in
  // contrast, is toggled synchronously inside `scan()` so tests and the
  // native scanner observe it before the async native scan call starts.
  useEffect(() => {
    if (!scanning) return
    const html = document.documentElement
    const body = document.body
    const prevHtmlBg = html.style.background
    const prevBodyBg = body.style.background
    html.style.background = 'transparent'
    body.style.background = 'transparent'
    return () => {
      html.style.background = prevHtmlBg
      body.style.background = prevBodyBg
    }
  }, [scanning])

  const scan = useCallback(async (): Promise<string | null> => {
    try {
      const {
        scan: nativeScan,
        cancel: nativeCancel,
        checkPermissions,
        requestPermissions,
        openAppSettings,
        Format,
      } = await import('@tauri-apps/plugin-barcode-scanner')

      cancelRef.current = nativeCancel

      let perms = await checkPermissions()
      if (perms === 'prompt') perms = await requestPermissions()
      if (perms !== 'granted') {
        console.error('[qr-scanner] Camera permission not granted:', perms)
        await openAppSettings()
        return null
      }

      setScanning(true)
      document.documentElement.classList.add('scanner-active')
      try {
        const result = await nativeScan({ windowed: true, formats: [Format.QRCode] })
        await nativeCancel()
        return result.content
      } catch (err) {
        console.error('[qr-scanner] Barcode scan failed:', err)
        return null
      } finally {
        document.documentElement.classList.remove('scanner-active')
        setScanning(false)
        cancelRef.current = null
      }
    } catch (err) {
      console.error('[qr-scanner] QR scanner plugin failed to load:', err)
      return null
    }
  }, [])

  const cancel = useCallback(async (): Promise<void> => {
    const current = cancelRef.current
    if (!current) return
    try {
      await current()
    } catch (err) {
      console.error('[qr-scanner] Failed to cancel scan:', err)
    } finally {
      cancelRef.current = null
      setScanning(false)
    }
  }, [])

  // Hooks above always run. The early return below does not change hook
  // order across renders because `isTauri()` is stable per session.
  if (!isTauri()) return null

  return { scanning, scan, cancel }
}
