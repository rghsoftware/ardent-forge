export type ValidationResult =
  | { status: 'ok' }
  | { status: 'no-schema'; message: string }
  | { status: 'unreachable'; message: string }

export type ConnectionUiStatus = ValidationResult['status'] | 'idle' | 'validating'

/**
 * Validates a Supabase connection by testing reachability and schema presence.
 *
 * Step 1 -- hit the PostgREST root to confirm the instance is reachable.
 * Step 2 -- query the `exercises` table to confirm the Ardent Forge schema
 *           has been applied.
 */
export async function validateConnection(url: string, key: string): Promise<ValidationResult> {
  const normalizedUrl = url.replace(/\/+$/, '')

  // Step 1: Reachability check
  try {
    const reachRes = await fetch(`${normalizedUrl}/rest/v1/`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(8000),
    })

    if (!reachRes.ok) {
      return {
        status: 'unreachable',
        message: `Server responded with ${reachRes.status}`,
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

  // Step 2: Schema presence check
  try {
    const schemaRes = await fetch(`${normalizedUrl}/rest/v1/exercises?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!schemaRes.ok) {
      if (schemaRes.status === 401 || schemaRes.status === 403) {
        return {
          status: 'unreachable',
          message:
            'API key does not have access to this project. Check that the key matches the URL.',
        }
      }
      return {
        status: 'no-schema',
        message:
          'Could not verify the database schema. Ensure the database migrations have been run.',
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
