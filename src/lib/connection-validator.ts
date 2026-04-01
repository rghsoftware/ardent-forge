import { createClient } from '@supabase/supabase-js'

export type ValidationResult =
  | { status: 'ok' }
  | { status: 'no-schema'; message: string }
  | { status: 'unreachable'; message: string }

export type ConnectionUiStatus = ValidationResult['status'] | 'idle' | 'validating'

/**
 * Validates a Supabase connection by creating a temporary client and querying
 * through it. This supports both legacy anon keys and new publishable keys
 * (sb_publishable_xxx) since the client library handles auth headers internally.
 *
 * Step 1 -- lightweight RPC to confirm the instance is reachable and the key is valid.
 * Step 2 -- query the `exercises` table to confirm the Ardent Forge schema
 *           has been applied.
 */
export async function validateConnection(url: string, key: string): Promise<ValidationResult> {
  const normalizedUrl = url.replace(/\/+$/, '')

  let client: ReturnType<typeof createClient>
  try {
    client = createClient(normalizedUrl, key)
  } catch {
    return {
      status: 'unreachable',
      message: 'Invalid Supabase URL or key format.',
    }
  }

  // Step 1: Reachability + key validity check
  // Use a lightweight query that works regardless of schema state.
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const { error } = await client
      .from('_placeholder_reachability_check')
      .select('*', { count: 'exact', head: true })
      .limit(0)
      .abortSignal(controller.signal)

    clearTimeout(timer)

    // A 401/403 means the key is invalid. A 404 or "relation does not exist"
    // error is fine -- it means the server is reachable and the key works.
    if (error) {
      const code = (error as unknown as { code?: string }).code
      const status = (error as unknown as { status?: number }).status
      const msg = error.message?.toLowerCase() ?? ''

      if (status === 401 || status === 403 || msg.includes('invalid api key') || msg.includes('invalid claim')) {
        return {
          status: 'unreachable',
          message: 'API key is not valid for this project. Check that the key matches the URL.',
        }
      }

      // Any other error (like "relation does not exist") means the server
      // is reachable and the key authenticated -- proceed to schema check.
      if (code !== 'PGRST116' && !msg.includes('does not exist') && status !== 404 && code !== '42P01') {
        // Unexpected error that isn't a missing-table error
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed')) {
          return {
            status: 'unreachable',
            message: 'Could not reach the Supabase instance. Check the URL and your network.',
          }
        }
      }
    }
  } catch (err) {
    const isTimeout =
      err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')
    if (isTimeout) {
      return {
        status: 'unreachable',
        message: 'Connection timed out. Check the URL and try again.',
      }
    }
    return {
      status: 'unreachable',
      message: 'Could not reach the Supabase instance. Check the URL and your network.',
    }
  }

  // Step 2: Schema presence check -- query an Ardent Forge table
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const { error } = await client
      .from('exercises')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal)

    clearTimeout(timer)

    if (error) {
      const status = (error as unknown as { status?: number }).status

      if (status === 401 || status === 403) {
        return {
          status: 'unreachable',
          message: 'API key does not have access to this project. Check that the key matches the URL.',
        }
      }

      return {
        status: 'no-schema',
        message: 'Could not verify the database schema. Ensure the database migrations have been run.',
      }
    }
  } catch (err) {
    const isNetworkError = err instanceof TypeError || err instanceof DOMException
    if (isNetworkError) {
      return {
        status: 'unreachable',
        message:
          'Reachability check passed but schema verification failed due to a network error. Try again.',
      }
    }
    return {
      status: 'unreachable',
      message: 'Schema verification failed unexpectedly. Try again.',
    }
  }

  return { status: 'ok' }
}
