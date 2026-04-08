/**
 * Single source of truth for the Supabase Realtime broadcast channel naming
 * used by the gym-scoped display pipeline (F018).
 *
 * Every publisher, subscriber, Edge Function, seed script, and test must use
 * these helpers instead of hard-coding the `display:gym:` literal.
 */

export const GYM_CHANNEL_PREFIX = 'display:gym:'

export function getGymChannelName(gymId: string): string {
  return `${GYM_CHANNEL_PREFIX}${gymId}`
}

export function parseGymIdFromChannel(channelName: string): string | null {
  if (!channelName.startsWith(GYM_CHANNEL_PREFIX)) return null
  return channelName.slice(GYM_CHANNEL_PREFIX.length) || null
}
