import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from 'sonner'

import { copyToClipboard } from '../copy-to-clipboard'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

const mockWriteText = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  // Stub navigator.clipboard per-test so the rejected-promise path can swap
  // in a mock that rejects.
  Object.assign(navigator, {
    clipboard: {
      writeText: mockWriteText,
    },
  })
})

// ---------------------------------------------------------------------------
// copyToClipboard
// ---------------------------------------------------------------------------

describe('copyToClipboard', () => {
  it('returns true and fires success toast on successful writeText', async () => {
    mockWriteText.mockResolvedValueOnce(undefined)

    const result = await copyToClipboard('hello', {
      successMessage: 'Copied!',
      failureMessage: 'Copy failed',
    })

    expect(result).toBe(true)
    expect(mockWriteText).toHaveBeenCalledWith('hello')
    expect(toast).toHaveBeenCalledWith('Copied!')
  })

  it('returns false and fires failure toast on rejected writeText', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockWriteText.mockRejectedValueOnce(new Error('denied'))

    const result = await copyToClipboard('hello', {
      successMessage: 'Copied!',
      failureMessage: 'Copy failed',
    })

    expect(result).toBe(false)
    expect(toast).toHaveBeenCalledWith('Copy failed')
    errorSpy.mockRestore()
  })

  it('logs errors with the default [clipboard] prefix', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockWriteText.mockRejectedValueOnce(new Error('denied'))

    await copyToClipboard('hello', {
      successMessage: 'ok',
      failureMessage: 'bad',
    })

    expect(errorSpy).toHaveBeenCalledWith(
      '[clipboard] Failed to write to clipboard:',
      expect.any(Error),
    )
    errorSpy.mockRestore()
  })

  it('logs errors with a custom logPrefix when provided', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockWriteText.mockRejectedValueOnce(new Error('denied'))

    await copyToClipboard('hello', {
      successMessage: 'ok',
      failureMessage: 'bad',
      logPrefix: 'display-setup',
    })

    expect(errorSpy).toHaveBeenCalledWith(
      '[display-setup] Failed to write to clipboard:',
      expect.any(Error),
    )
    errorSpy.mockRestore()
  })

  it('does not fire the failure toast on success', async () => {
    mockWriteText.mockResolvedValueOnce(undefined)

    await copyToClipboard('hello', {
      successMessage: 'Copied!',
      failureMessage: 'Copy failed',
    })

    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Copied!')
  })

  it('does not fire the success toast on failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockWriteText.mockRejectedValueOnce(new Error('denied'))

    await copyToClipboard('hello', {
      successMessage: 'Copied!',
      failureMessage: 'Copy failed',
    })

    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Copy failed')
    errorSpy.mockRestore()
  })
})
