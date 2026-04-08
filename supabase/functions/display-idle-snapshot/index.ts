import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS: wildcard origin is acceptable -- this function is only invoked by
// Supabase cron (verify_jwt = false), not by browsers directly.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---------------------------------------------------------------------------
// Channel naming
//
// Duplicated from src/lib/gym-channel.ts -- the source of truth lives there.
// Deno-side code cannot import from src/lib/, so the prefix constant is
// inlined here. Keep the two in sync. F018 / Tech.md D3.
// ---------------------------------------------------------------------------
const GYM_CHANNEL_PREFIX = 'display:gym:'

function getGymChannelName(gymId: string): string {
  return `${GYM_CHANNEL_PREFIX}${gymId}`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledSession {
  display_name: string
  session_name: string
  session_type: string
  day_label: string
}

interface IdleSnapshotPayload {
  server_time: string
  scheduled_sessions: ScheduledSession[]
  next_session: { display_name: string; session_name: string } | null
}

interface GymRow {
  id: string
}

interface BroadcastResult {
  gym_id: string
  ok: boolean
  session_count: number
  status?: number
  body?: string
  // Postgres SQLSTATE or PostgREST error code, if available. Used by the
  // outer handler to classify failures as permanent vs transient (P14-040).
  error_code?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Permanent error codes that the cron should NOT retry. Returning 200 for
 * these stops the cron from spamming logs every minute on a misconfigured
 * RLS policy or schema drift. Transient codes (5xx, network) are NOT in this
 * list and trigger a 502 retry.
 *
 * P14-040: this is a hand-curated allowlist; new permanent codes can be
 * added as they're observed in production.
 */
const PERMANENT_ERROR_CODES = new Set<string>([
  '42501', // insufficient_privilege (RLS denied)
  '42P01', // undefined_table (schema drift)
  '42703', // undefined_column
  '42883', // undefined_function
  'PGRST116', // PostgREST: no rows when one expected
  'PGRST301', // PostgREST: RLS-rejected
])

function isPermanentErrorCode(code: string | undefined): boolean {
  if (!code) return false
  if (PERMANENT_ERROR_CODES.has(code)) return true
  // HTTP 4xx broadcast failures (encoded as HTTP_4xx) are permanent --
  // 401/403/404 will not recover on retry.
  if (code.startsWith('HTTP_4')) return true
  return false
}

function isValidScheduledSession(r: unknown): r is ScheduledSession {
  if (typeof r !== 'object' || r === null) return false
  const obj = r as Record<string, unknown>
  return (
    typeof obj.display_name === 'string' &&
    typeof obj.session_name === 'string' &&
    typeof obj.session_type === 'string' &&
    typeof obj.day_label === 'string'
  )
}

function buildIdleSnapshot(sessions: ScheduledSession[]): IdleSnapshotPayload {
  const first = sessions[0]
  return {
    server_time: new Date().toISOString(),
    scheduled_sessions: sessions,
    next_session: first
      ? { display_name: first.display_name, session_name: first.session_name }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // -----------------------------------------------------------------------
    // 1. Validate environment configuration
    // -----------------------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[display-idle-snapshot] Missing required environment configuration')
      return new Response(JSON.stringify({ error: 'Missing configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // -----------------------------------------------------------------------
    // 2. Fetch every gym (one query per invocation). The Edge Function
    //    fans out one broadcast per gym in a single cron tick.
    // -----------------------------------------------------------------------
    const { data: gymsData, error: gymsError } = await supabase.from('gyms').select('id')

    if (gymsError) {
      console.error(
        '[display-idle-snapshot] Failed to list gyms:',
        gymsError.message,
        gymsError.code,
      )
      return new Response(JSON.stringify({ error: 'Gym query failed', code: gymsError.code }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const gyms: GymRow[] = (gymsData ?? []).filter(
      (g: unknown): g is GymRow => typeof (g as { id?: unknown } | null)?.id === 'string',
    )

    if (gyms.length === 0) {
      // Empty instance: no gyms, nothing to broadcast. Not an error.
      return new Response(
        JSON.stringify({
          published: true,
          gym_count: 0,
          total_sessions: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // -----------------------------------------------------------------------
    // 3. For each gym, query its scheduled sessions and broadcast a payload
    //    to its dedicated realtime channel. Errors on a single gym are
    //    logged but do not abort the loop -- one bad gym should not block
    //    broadcasts to the others.
    // -----------------------------------------------------------------------
    const broadcastUrl = `${supabaseUrl}/realtime/v1/api/broadcast`
    const results: BroadcastResult[] = []

    for (const gym of gyms) {
      const result = await broadcastForGym({
        gymId: gym.id,
        supabase,
        broadcastUrl,
        serviceRoleKey,
      })
      results.push(result)
    }

    const allOk = results.every((r) => r.ok)
    const totalSessions = results.reduce((sum, r) => sum + r.session_count, 0)

    if (!allOk) {
      // Some gyms failed. P14-040: classify failures so the cron can decide
      // whether to retry. Permanent failures (RLS, schema) get 200 so the
      // cron stops retrying and the logs show one error per cycle instead
      // of an unbounded spam loop. Transient failures (5xx, network) get
      // 502 so the cron retries on the next tick.
      const failures = results.filter((r) => !r.ok)
      const allPermanent = failures.every((f) => isPermanentErrorCode(f.error_code))
      console.error(
        `[display-idle-snapshot] Partial broadcast failure (allPermanent=${allPermanent}):`,
        JSON.stringify(failures),
      )

      // If every failing gym shares the same error code, surface it as a
      // pattern alert so operators notice systemic issues (e.g., a tightened
      // RLS policy that bricked every gym at once).
      const codes = new Set(failures.map((f) => f.error_code).filter((c) => c !== undefined))
      const sharedCode = codes.size === 1 ? ([...codes][0] as string) : undefined
      if (sharedCode) {
        console.error(
          `[display-idle-snapshot] All ${failures.length} failures share code: ${sharedCode}`,
        )
      }

      // External alerting hook (P15-051): scrape `permanent_failure: true`
      // in the response body, or the `[display-idle-snapshot] PERMANENT_FAILURE`
      // structured log line, to wire up an external alerter (Vercel/Supabase
      // log alerts, Datadog, Sentry, etc.). A systemic permanent failure --
      // every failing gym sharing the same permanent error code -- almost
      // always means a config or schema regression bricked the whole
      // instance (broken RLS policy, missing grant, renamed column), and
      // needs a human in the loop because the cron alone cannot self-heal.
      // No Sentry SDK is wired into supabase/functions/ today, so the
      // structured console.error is the surfacing mechanism; swap it out
      // for a Sentry breadcrumb if/when the SDK is added.
      const isPermanentFailure = allPermanent && sharedCode !== undefined
      if (isPermanentFailure) {
        console.error('[display-idle-snapshot] PERMANENT_FAILURE', {
          error_code: sharedCode,
          failure_count: failures.length,
          gym_count: gyms.length,
        })
      }

      return new Response(
        JSON.stringify({
          published: false,
          gym_count: gyms.length,
          total_sessions: totalSessions,
          failures,
          permanent: allPermanent,
          // Additive alerting fields (P15-051). Present only when all
          // failures share a permanent error code. Absent on transient
          // partial failures or on a mix of permanent and transient codes.
          ...(isPermanentFailure
            ? {
                permanent_failure: true,
                error_code: sharedCode,
                failure_count: failures.length,
              }
            : {}),
        }),
        {
          status: allPermanent ? 200 : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // -----------------------------------------------------------------------
    // 4. Return success summary
    // -----------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        published: true,
        gym_count: gyms.length,
        total_sessions: totalSessions,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    console.error('[display-idle-snapshot] Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

// ---------------------------------------------------------------------------
// Per-gym broadcast helper
// ---------------------------------------------------------------------------

interface BroadcastForGymArgs {
  gymId: string
  // `ReturnType<typeof createClient>` matches the exact inferred client
  // type from the esm.sh import at the top of the file -- avoids the
  // `@typescript-eslint/no-explicit-any` rule while staying in sync with
  // the concrete createClient overload this function uses.
  supabase: ReturnType<typeof createClient>
  broadcastUrl: string
  serviceRoleKey: string
}

async function broadcastForGym(args: BroadcastForGymArgs): Promise<BroadcastResult> {
  const { gymId, supabase, broadcastUrl, serviceRoleKey } = args

  // Query this gym's idle sessions via the gym-scoped RPC.
  const { data: sessionRows, error: queryError } = await supabase.rpc('get_display_idle_sessions', {
    p_gym_id: gymId,
  })

  if (queryError) {
    console.error(
      `[display-idle-snapshot] RPC failed for gym ${gymId}:`,
      queryError.message,
      queryError.code,
    )
    return { gym_id: gymId, ok: false, session_count: 0, error_code: queryError.code }
  }

  const rows: unknown[] = sessionRows ?? []
  const sessions: ScheduledSession[] = rows.filter(isValidScheduledSession)

  const idleSnapshotPayload = buildIdleSnapshot(sessions)

  // The realtime broadcast topic format is `realtime:` + channel name.
  // The channel name comes from the F018 helper duplicated at the top of
  // this file -- single source of truth lives in src/lib/gym-channel.ts.
  const topic = `realtime:${getGymChannelName(gymId)}`

  let broadcastResponse: Response
  try {
    broadcastResponse = await fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        messages: [
          {
            topic,
            event: 'idle_snapshot',
            payload: idleSnapshotPayload,
          },
        ],
      }),
    })
  } catch (err) {
    console.error(`[display-idle-snapshot] Broadcast fetch threw for gym ${gymId}:`, err)
    return { gym_id: gymId, ok: false, session_count: sessions.length }
  }

  if (!broadcastResponse.ok) {
    const body = await broadcastResponse.text()
    console.error(
      `[display-idle-snapshot] Broadcast failed for gym ${gymId}:`,
      broadcastResponse.status,
      body,
    )
    // Encode the HTTP status as the error_code so the outer handler can
    // classify 4xx (permanent: bad config, auth) vs 5xx (transient).
    return {
      gym_id: gymId,
      ok: false,
      session_count: sessions.length,
      status: broadcastResponse.status,
      body,
      error_code: `HTTP_${broadcastResponse.status}`,
    }
  }

  return { gym_id: gymId, ok: true, session_count: sessions.length }
}

Deno.serve(handler)
