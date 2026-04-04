import type { MediaType } from '@/domain/types'

// ---------------------------------------------------------------------------
// Centralized media validation constraints (CH-6)
// ---------------------------------------------------------------------------

export const MEDIA_CONSTRAINTS = {
  video: {
    maxSizeBytes: 50 * 1024 * 1024, // 50 MB
    maxDurationSeconds: 60,
    allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    allowedExtensions: ['.mp4', '.mov', '.webm'],
  },
  image: {
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
  },
  file: {
    maxSizeBytes: 25 * 1024 * 1024, // 25 MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
      'application/zip',
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.zip'],
    blockedExtensions: [
      '.exe',
      '.bat',
      '.sh',
      '.cmd',
      '.ps1',
      '.msi',
      '.app',
      '.dmg',
      '.jar',
      '.com',
      '.scr',
      '.vbs',
      '.wsf',
    ],
  },
} as const satisfies Record<MediaType, unknown>

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationResult = { valid: true } | { valid: false; error: string }

/**
 * Validates a file against the constraints for the given media type.
 * For videos, also checks duration via HTMLVideoElement metadata.
 */
export async function validateFile(file: File, type: MediaType): Promise<ValidationResult> {
  const ext = extractExtension(file.name)

  if (type === 'video') {
    return validateVideo(file, ext)
  }
  if (type === 'image') {
    return validateImage(file, ext)
  }
  return validateGenericFile(file, ext)
}

// ---------------------------------------------------------------------------
// Per-type validators
// ---------------------------------------------------------------------------

function validateVideo(file: File, ext: string): Promise<ValidationResult> {
  const c = MEDIA_CONSTRAINTS.video

  if (!c.allowedMimeTypes.includes(file.type as (typeof c.allowedMimeTypes)[number])) {
    return resolved({
      valid: false,
      error: `Unsupported video format. Allowed: ${c.allowedExtensions.join(', ')}`,
    })
  }

  if (ext && !c.allowedExtensions.includes(ext as (typeof c.allowedExtensions)[number])) {
    return resolved({
      valid: false,
      error: `Unsupported video extension. Allowed: ${c.allowedExtensions.join(', ')}`,
    })
  }

  if (file.size > c.maxSizeBytes) {
    return resolved({
      valid: false,
      error: `Video exceeds ${c.maxSizeBytes / (1024 * 1024)} MB limit.`,
    })
  }

  return validateVideoDuration(file, c.maxDurationSeconds)
}

function validateImage(file: File, ext: string): Promise<ValidationResult> {
  const c = MEDIA_CONSTRAINTS.image

  if (!c.allowedMimeTypes.includes(file.type as (typeof c.allowedMimeTypes)[number])) {
    return resolved({
      valid: false,
      error: `Unsupported image format. Allowed: ${c.allowedExtensions.join(', ')}`,
    })
  }

  if (ext && !c.allowedExtensions.includes(ext as (typeof c.allowedExtensions)[number])) {
    return resolved({
      valid: false,
      error: `Unsupported image extension. Allowed: ${c.allowedExtensions.join(', ')}`,
    })
  }

  if (file.size > c.maxSizeBytes) {
    return resolved({
      valid: false,
      error: `Image exceeds ${c.maxSizeBytes / (1024 * 1024)} MB limit.`,
    })
  }

  return resolved({ valid: true })
}

function validateGenericFile(file: File, ext: string): Promise<ValidationResult> {
  const c = MEDIA_CONSTRAINTS.file

  if (ext && c.blockedExtensions.includes(ext as (typeof c.blockedExtensions)[number])) {
    return resolved({ valid: false, error: `File type "${ext}" is not allowed.` })
  }

  if (ext && !c.allowedExtensions.includes(ext as (typeof c.allowedExtensions)[number])) {
    return resolved({
      valid: false,
      error: `Unsupported file type. Allowed: ${c.allowedExtensions.join(', ')}`,
    })
  }

  if (file.size > c.maxSizeBytes) {
    return resolved({
      valid: false,
      error: `File exceeds ${c.maxSizeBytes / (1024 * 1024)} MB limit.`,
    })
  }

  return resolved({ valid: true })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function extractExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1) return ''
  return filename.slice(dotIndex).toLowerCase()
}

/**
 * Loads video metadata via a temporary HTMLVideoElement to read duration.
 * Returns a validation error if the video exceeds the max duration.
 */
function validateVideoDuration(file: File, maxDurationSeconds: number): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'

    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
    }

    video.onloadedmetadata = () => {
      const duration = video.duration
      cleanup()
      if (!Number.isFinite(duration)) {
        resolve({ valid: false, error: 'Could not determine video duration.' })
        return
      }
      if (duration > maxDurationSeconds) {
        resolve({
          valid: false,
          error: `Video exceeds ${maxDurationSeconds} second limit (${Math.ceil(duration)}s).`,
        })
        return
      }
      resolve({ valid: true })
    }

    video.onerror = () => {
      cleanup()
      resolve({ valid: false, error: 'Could not read video metadata.' })
    }

    video.src = url
  })
}

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value)
}
