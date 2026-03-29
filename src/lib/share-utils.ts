import { shareTokenSchema } from '@/domain/types'
import type { ShareToken } from '@/domain/types'

/**
 * Generates a cryptographically random 12-character alphanumeric share token.
 * Uses crypto.getRandomValues for security.
 */
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function generateShareToken(): ShareToken {
  const values = new Uint8Array(12)
  crypto.getRandomValues(values)
  const raw = Array.from(values)
    .map((v) => CHARSET[v % CHARSET.length])
    .join('')
  return shareTokenSchema.parse(raw)
}
