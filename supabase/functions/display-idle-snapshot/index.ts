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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      // Some gyms failed. Return 502 so the cron retries, but include the
      // per-gym status so logs are diagnostic.
      console.error(
        '[display-idle-snapshot] Partial broadcast failure:',
        JSON.stringify(results.filter((r) => !r.ok)),
      )
      return new Response(
        JSON.stringify({
          published: false,
          gym_count: gyms.length,
          total_sessions: totalSessions,
          failures: results.filter((r) => !r.ok),
        }),
        {
          status: 502,
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
    return { gym_id: gymId, ok: false, session_count: 0 }
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
    return {
      gym_id: gymId,
      ok: false,
      session_count: sessions.length,
      status: broadcastResponse.status,
      body,
    }
  }

  return { gym_id: gymId, ok: true, session_count: sessions.length }
}

Deno.serve(handler)
