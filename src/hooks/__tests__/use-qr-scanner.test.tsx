// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Module mocks -- must be registered before importing the hook under test.
// ---------------------------------------------------------------------------

const isTauriMock = vi.fn(() => true)

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => isTauriMock(),
}))

const scanMock = vi.fn()
const cancelMock = vi.fn()
const checkPermissionsMock = vi.fn()
const requestPermissionsMock = vi.fn()
const openAppSettingsMock = vi.fn()

vi.mock('@tauri-apps/plugin-barcode-scanner', () => ({
  scan: (...args: unknown[]) => scanMock(...args),
  cancel: () => cancelMock(),
  checkPermissions: () => checkPermissionsMock(),
  requestPermissions: () => requestPermissionsMock(),
  openAppSettings: () => openAppSettingsMock(),
  Format: { QRCode: 'QR_CODE' },
}))

import { useQrScanner } from '../use-qr-scanner'

beforeEach(() => {
  vi.clearAllMocks()
  isTauriMock.mockReturnValue(true)
  checkPermissionsMock.mockResolvedValue('granted')
  cancelMock.mockResolvedValue(undefined)
  openAppSettingsMock.mockResolvedValue(undefined)
  // Reset any classes the hook may have added to <html>.
  document.documentElement.classList.remove('scanner-active')
  document.documentElement.style.background = ''
  document.body.style.background = ''
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tauri gate
// ---------------------------------------------------------------------------

describe('useQrScanner gate', () => {
  it('returns null when not running in Tauri', () => {
    isTauriMock.mockReturnValue(false)
    const { result } = renderHook(() => useQrScanner())
    expect(result.current).toBeNull()
  })

  it('returns an object with scan/cancel/scanning on Tauri', () => {
    const { result } = renderHook(() => useQrScanner())
    expect(result.current).not.toBeNull()
    expect(typeof result.current?.scan).toBe('function')
    expect(typeof result.current?.cancel).toBe('function')
    expect(result.current?.scanning).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// scan() success path
// ---------------------------------------------------------------------------

describe('useQrScanner.scan success', () => {
  it('resolves with decoded content on a successful scan', async () => {
    scanMock.mockResolvedValue({ content: 'https://forge.example.com/display/gym/abc' })
    const { result } = renderHook(() => useQrScanner())

    let content: string | null = null
    await act(async () => {
      content = (await result.current!.scan()) ?? null
    })

    expect(content).toBe('https://forge.example.com/display/gym/abc')
    expect(scanMock).toHaveBeenCalledWith({ windowed: true, formats: ['QR_CODE'] })
    expect(cancelMock).toHaveBeenCalled()
  })

  it('requests permissions when status is prompt', async () => {
    checkPermissionsMock.mockResolvedValue('prompt')
    requestPermissionsMock.mockResolvedValue('granted')
    scanMock.mockResolvedValue({ content: 'payload' })

    const { result } = renderHook(() => useQrScanner())

    await act(async () => {
      await result.current!.scan()
    })

    expect(requestPermissionsMock).toHaveBeenCalled()
    expect(scanMock).toHaveBeenCalled()
  })

  it('clears scanning state after a successful scan', async () => {
    scanMock.mockResolvedValue({ content: 'payload' })
    const { result } = renderHook(() => useQrScanner())

    await act(async () => {
      await result.current!.scan()
    })

    expect(result.current?.scanning).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// scan() failure / cancel paths
// ---------------------------------------------------------------------------

describe('useQrScanner.scan failure paths', () => {
  it('returns null and opens settings when permissions are denied', async () => {
    checkPermissionsMock.mockResolvedValue('denied')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useQrScanner())

    let content: string | null = 'sentinel'
    await act(async () => {
      content = await result.current!.scan()
    })

    expect(content).toBeNull()
    expect(openAppSettingsMock).toHaveBeenCalled()
    expect(scanMock).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[qr-scanner] Camera permission not granted'),
      'denied',
    )
    errorSpy.mockRestore()
  })

  it('returns null and logs when the scan itself rejects', async () => {
    scanMock.mockRejectedValue(new Error('user cancelled'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useQrScanner())

    let content: string | null = 'sentinel'
    await act(async () => {
      content = await result.current!.scan()
    })

    expect(content).toBeNull()
    expect(errorSpy).toHaveBeenCalledWith('[qr-scanner] Barcode scan failed:', expect.any(Error))
    errorSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Transparent webview side effect
// ---------------------------------------------------------------------------

describe('useQrScanner transparent webview side effect', () => {
  it('toggles the scanner-active class while scanning', async () => {
    // Use a slow scan so we can observe the intermediate state by
    // inspecting the DOM from inside the `scanMock` implementation.
    let classDuringScan = false
    scanMock.mockImplementation(() => {
      classDuringScan = document.documentElement.classList.contains('scanner-active')
      return Promise.resolve({ content: 'payload' })
    })

    const { result } = renderHook(() => useQrScanner())

    await act(async () => {
      await result.current!.scan()
    })

    expect(classDuringScan).toBe(true)
    // After the scan resolves, the class should be removed.
    expect(document.documentElement.classList.contains('scanner-active')).toBe(false)
  })
})
