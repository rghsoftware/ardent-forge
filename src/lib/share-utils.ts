/**
 * Generates a cryptographically random 12-character alphanumeric share token.
 * Uses crypto.getRandomValues for security.
 */
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function generateShareToken(): string {
  const values = new Uint8Array(12)
  crypto.getRandomValues(values)
  return Array.from(values)
    .map((v) => CHARSET[v % CHARSET.length])
    .join('')
}
