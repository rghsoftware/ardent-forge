export type ValidationResult = {
  status: 'ok' | 'no-schema' | 'unreachable'
  message?: string
}

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
    })

    if (!reachRes.ok) {
      return {
        status: 'unreachable',
        message: `Server responded with ${reachRes.status}`,
      }
    }
  } catch (err) {
    return {
      status: 'unreachable',
      message: err instanceof Error ? err.message : 'Network error',
    }
  }

  // Step 2: Schema presence check
  try {
    const schemaRes = await fetch(`${normalizedUrl}/rest/v1/exercises?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    })

    if (!schemaRes.ok) {
      return {
        status: 'no-schema',
        message: 'Connected, but database schema not found. See the setup guide.',
      }
    }
  } catch {
    return {
      status: 'no-schema',
      message: 'Connected, but could not verify schema.',
    }
  }

  return { status: 'ok' }
}
