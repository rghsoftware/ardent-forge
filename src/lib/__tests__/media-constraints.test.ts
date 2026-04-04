// @vitest-environment happy-dom
import { vi, describe, it, expect, beforeAll } from 'vitest'
import { validateFile, MEDIA_CONSTRAINTS } from '@/lib/media-constraints'

// ---------------------------------------------------------------------------
// DOM mocks -- validateVideoDuration needs document.createElement('video')
// and URL.createObjectURL
// ---------------------------------------------------------------------------

beforeAll(() => {
  // Mock URL.createObjectURL / revokeObjectURL
  if (!globalThis.URL.createObjectURL) {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  }
  if (!globalThis.URL.revokeObjectURL) {
    globalThis.URL.revokeObjectURL = vi.fn()
  }

  // Mock document.createElement to return a mock video element for 'video'
  const origCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'video') {
      let internalSrc = ''
      let onloadedmetadata: (() => void) | null = null
      const mockVideo = {
        preload: '',
        duration: 30, // 30 seconds -- under the 60s limit
        onerror: null as (() => void) | null,
        removeAttribute: vi.fn(),
        load: vi.fn(),
      }
      Object.defineProperty(mockVideo, 'src', {
        get() {
          return internalSrc
        },
        set(val: string) {
          internalSrc = val
          if (onloadedmetadata) {
            setTimeout(() => onloadedmetadata?.(), 0)
          }
        },
        configurable: true,
      })
      Object.defineProperty(mockVideo, 'onloadedmetadata', {
        get() {
          return onloadedmetadata
        },
        set(val: (() => void) | null) {
          onloadedmetadata = val
        },
        configurable: true,
      })
      return mockVideo as unknown as HTMLVideoElement
    }
    return origCreateElement(tag)
  })
})

// ---------------------------------------------------------------------------
// Helpers -- create File objects with specific properties
// ---------------------------------------------------------------------------

function createFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type })
}

// ===========================================================================
// Video validation
// ===========================================================================

describe('validateFile - video', () => {
  it('accepts a valid 20 MB MP4 (mocked 30s duration)', async () => {
    const file = createFile('clip.mp4', 20 * 1024 * 1024, 'video/mp4')
    const result = await validateFile(file, 'video')
    expect(result.valid).toBe(true)
  })

  it('rejects a 60 MB video (exceeds 50 MB limit)', async () => {
    const file = createFile('big.mp4', 60 * 1024 * 1024, 'video/mp4')
    const result = await validateFile(file, 'video')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('50')
    }
  })

  it('rejects an AVI format video', async () => {
    const file = createFile('clip.avi', 10 * 1024 * 1024, 'video/x-msvideo')
    const result = await validateFile(file, 'video')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('Unsupported video format')
    }
  })

  it('rejects video with unsupported extension', async () => {
    const file = createFile('clip.flv', 5 * 1024 * 1024, 'video/mp4')
    const result = await validateFile(file, 'video')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('Unsupported video extension')
    }
  })

  it('exposes correct video constraints', () => {
    expect(MEDIA_CONSTRAINTS.video.maxSizeBytes).toBe(50 * 1024 * 1024)
    expect(MEDIA_CONSTRAINTS.video.maxDurationSeconds).toBe(60)
    expect(MEDIA_CONSTRAINTS.video.allowedMimeTypes).toContain('video/mp4')
    expect(MEDIA_CONSTRAINTS.video.allowedMimeTypes).toContain('video/quicktime')
    expect(MEDIA_CONSTRAINTS.video.allowedMimeTypes).toContain('video/webm')
  })
})

// ===========================================================================
// Image validation
// ===========================================================================

describe('validateFile - image', () => {
  it('accepts a valid 5 MB JPEG', async () => {
    const file = createFile('photo.jpg', 5 * 1024 * 1024, 'image/jpeg')
    const result = await validateFile(file, 'image')
    expect(result.valid).toBe(true)
  })

  it('rejects a 15 MB PNG (exceeds 10 MB limit)', async () => {
    const file = createFile('large.png', 15 * 1024 * 1024, 'image/png')
    const result = await validateFile(file, 'image')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('10')
    }
  })

  it('rejects BMP format', async () => {
    const file = createFile('photo.bmp', 1 * 1024 * 1024, 'image/bmp')
    const result = await validateFile(file, 'image')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('Unsupported image format')
    }
  })

  it('accepts WebP format', async () => {
    const file = createFile('photo.webp', 2 * 1024 * 1024, 'image/webp')
    const result = await validateFile(file, 'image')
    expect(result.valid).toBe(true)
  })

  it('accepts HEIC format', async () => {
    const file = createFile('photo.heic', 3 * 1024 * 1024, 'image/heic')
    const result = await validateFile(file, 'image')
    expect(result.valid).toBe(true)
  })

  it('exposes correct image constraints', () => {
    expect(MEDIA_CONSTRAINTS.image.maxSizeBytes).toBe(10 * 1024 * 1024)
    expect(MEDIA_CONSTRAINTS.image.allowedMimeTypes).toContain('image/jpeg')
    expect(MEDIA_CONSTRAINTS.image.allowedMimeTypes).toContain('image/png')
    expect(MEDIA_CONSTRAINTS.image.allowedMimeTypes).toContain('image/webp')
    expect(MEDIA_CONSTRAINTS.image.allowedMimeTypes).toContain('image/heic')
  })
})

// ===========================================================================
// File validation
// ===========================================================================

describe('validateFile - file', () => {
  it('accepts a valid 10 MB PDF', async () => {
    const file = createFile('doc.pdf', 10 * 1024 * 1024, 'application/pdf')
    const result = await validateFile(file, 'file')
    expect(result.valid).toBe(true)
  })

  it('rejects a 30 MB PDF (exceeds 25 MB limit)', async () => {
    const file = createFile('huge.pdf', 30 * 1024 * 1024, 'application/pdf')
    const result = await validateFile(file, 'file')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('25')
    }
  })

  it('rejects .exe extension (blocklisted)', async () => {
    const file = createFile('malware.exe', 1024, 'application/octet-stream')
    const result = await validateFile(file, 'file')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('.exe')
    }
  })

  it('rejects .sh extension (blocklisted)', async () => {
    const file = createFile('script.sh', 512, 'text/x-shellscript')
    const result = await validateFile(file, 'file')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('.sh')
    }
  })

  it('accepts .docx extension', async () => {
    const file = createFile(
      'report.docx',
      5 * 1024 * 1024,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    const result = await validateFile(file, 'file')
    expect(result.valid).toBe(true)
  })

  it('rejects unknown extension not on allowlist', async () => {
    const file = createFile('data.iso', 5 * 1024 * 1024, 'application/octet-stream')
    const result = await validateFile(file, 'file')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('Unsupported file type')
    }
  })

  it('exposes correct file constraints', () => {
    expect(MEDIA_CONSTRAINTS.file.maxSizeBytes).toBe(25 * 1024 * 1024)
    expect(MEDIA_CONSTRAINTS.file.blockedExtensions).toContain('.exe')
    expect(MEDIA_CONSTRAINTS.file.blockedExtensions).toContain('.sh')
    expect(MEDIA_CONSTRAINTS.file.blockedExtensions).toContain('.bat')
    expect(MEDIA_CONSTRAINTS.file.allowedExtensions).toContain('.pdf')
    expect(MEDIA_CONSTRAINTS.file.allowedExtensions).toContain('.docx')
  })
})
