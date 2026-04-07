/**
 * Tests for the display-idle-snapshot Edge Function (F018).
 *
 * Validates the per-gym fan-out: one broadcast per gym, disjoint topics,
 * disjoint scheduled-sessions payloads. Maps to TA10, M17, D6.
 *
 * Run: deno test --config supabase/deno.test.jsonc supabase/functions/display-idle-snapshot/
 */

import { assertEquals } from 'jsr:@std/assert'
import { mockState, resetMockState } from '../_test-utils/mock-supabase.ts'
import { mockEnv, mockFetch, parseJson, STANDARD_ENV } from '../_test-utils/helpers.ts'
import { handler } from './index.ts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GYM_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const GYM_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const BROADCAST_PATH = '/realtime/v1/api/broadcast'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CapturedBroadcast {
  url: string
  topic: string
  event: string
  payload: Record<string, unknown>
}

interface FetchSpy {
  calls: CapturedBroadcast[]
  install: () => () => void
  failOne: (gymId: string) => void
}

function createFetchSpy(): FetchSpy {
  const calls: CapturedBroadcast[] = []
  const failingGymIds = new Set<string>()

  const handlerFn = (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const bodyText = (init?.body as string | undefined) ?? ''
    let parsed: { messages?: Array<{ topic: string; event: string; payload: unknown }> } = {}
    try {
      parsed = JSON.parse(bodyText)
    } catch (err) {
      console.error('[fetch-spy] Failed to parse body:', err)
    }
    const message = parsed.messages?.[0]
    const topic = message?.topic ?? ''
    const event = message?.event ?? ''
    const payload = (message?.payload ?? {}) as Record<string, unknown>

    calls.push({ url, topic, event, payload })

    // Per-gym failure mode: respond non-ok when the topic suffix matches
    // a registered failing gym id.
    for (const failingId of failingGymIds) {
      if (topic.endsWith(failingId)) {
        return Promise.resolve(new Response('upstream error', { status: 500 }))
      }
    }
    return Promise.resolve(new Response('ok', { status: 200 }))
  }

  return {
    calls,
    install: () => mockFetch(handlerFn),
    failOne: (gymId: string) => {
      failingGymIds.add(gymId)
    },
  }
}

function configureGymList(gymIds: string[]): void {
  mockState.selectListResults.set('gyms', {
    data: gymIds.map((id) => ({ id })),
    error: null,
  })
}

function configurePerGymRpc(map: Record<string, Array<Record<string, string>>>): void {
  mockState.rpcFns.set('get_display_idle_sessions', (params) => {
    const gymId = params.p_gym_id as string
    const rows = map[gymId] ?? []
    return { data: rows, error: null }
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('display-idle-snapshot handler', async (t) => {
  let restoreEnv: (() => void) | undefined
  let restoreFetch: (() => void) | undefined
  let spy: FetchSpy

  function setup() {
    resetMockState()
    spy = createFetchSpy()
    restoreEnv = mockEnv(STANDARD_ENV)
    restoreFetch = spy.install()
  }

  function teardown() {
    restoreFetch?.()
    restoreEnv?.()
  }

  // -------------------------------------------------------------------------
  // Method handling
  // -------------------------------------------------------------------------

  await t.step('returns 200 on CORS preflight (OPTIONS)', async () => {
    setup()
    const res = await handler(new Request('http://localhost/test', { method: 'OPTIONS' }))
    assertEquals(res.status, 200)
    teardown()
  })

  // -------------------------------------------------------------------------
  // Environment validation
  // -------------------------------------------------------------------------

  await t.step('returns 500 when SUPABASE_URL missing', async () => {
    resetMockState()
    spy = createFetchSpy()
    restoreEnv = mockEnv({}) // empty env -- both vars missing
    restoreFetch = spy.install()
    const res = await handler(new Request('http://localhost/test', { method: 'POST' }))
    assertEquals(res.status, 500)
    teardown()
  })

  // -------------------------------------------------------------------------
  // Empty gym list
  // -------------------------------------------------------------------------

  await t.step('returns 200 with gym_count=0 when no gyms exist', async () => {
    setup()
    configureGymList([])

    const res = await handler(new Request('http://localhost/test', { method: 'POST' }))
    const { status, body } = await parseJson(res)
    const summary = body as { published: boolean; gym_count: number; total_sessions: number }

    assertEquals(status, 200)
    assertEquals(summary.published, true)
    assertEquals(summary.gym_count, 0)
    assertEquals(summary.total_sessions, 0)
    assertEquals(spy.calls.length, 0)
    teardown()
  })

  await t.step('returns 500 when listing gyms fails', async () => {
    setup()
    mockState.selectListResults.set('gyms', {
      data: null,
      error: { message: 'connection refused', code: 'PG-001' },
    })

    const res = await handler(new Request('http://localhost/test', { method: 'POST' }))
    assertEquals(res.status, 500)
    assertEquals(spy.calls.length, 0)
    teardown()
  })

  // -------------------------------------------------------------------------
  // Per-gym fan-out (the core F018 assertion)
  // -------------------------------------------------------------------------

  await t.step(
    'fans out one broadcast per gym with disjoint topics and disjoint payloads',
    async () => {
      setup()
      configureGymList([GYM_A_ID, GYM_B_ID])
      configurePerGymRpc({
        [GYM_A_ID]: [
          {
            display_name: 'User A',
            session_name: 'Upper Body Strength',
            session_type: 'STRENGTH',
            day_label: 'Day 1 - Upper',
          },
        ],
        [GYM_B_ID]: [
          {
            display_name: 'User B',
            session_name: 'Lower Body Strength',
            session_type: 'STRENGTH',
            day_label: 'Day 2 - Lower',
          },
        ],
      })

      const res = await handler(new Request('http://localhost/test', { method: 'POST' }))
      const { status, body } = await parseJson(res)
      const summary = body as { published: boolean; gym_count: number; total_sessions: number }

      // 4a. Response shape
      assertEquals(status, 200)
      assertEquals(summary.published, true)
      assertEquals(summary.gym_count, 2)
      assertEquals(summary.total_sessions, 2)

      // 4b. Two broadcast POSTs
      assertEquals(spy.calls.length, 2)
      for (const call of spy.calls) {
        assertEquals(call.url.endsWith(BROADCAST_PATH), true, `bad URL: ${call.url}`)
        assertEquals(call.event, 'idle_snapshot')
      }

      // 4c. Disjoint topics
      const topics = spy.calls.map((c) => c.topic).sort()
      assertEquals(topics, [`realtime:display:gym:${GYM_A_ID}`, `realtime:display:gym:${GYM_B_ID}`])

      // 4d. Disjoint scheduled_sessions payloads
      const callA = spy.calls.find((c) => c.topic.endsWith(GYM_A_ID))!
      const callB = spy.calls.find((c) => c.topic.endsWith(GYM_B_ID))!
      const sessionsA = callA.payload.scheduled_sessions as Array<Record<string, string>>
      const sessionsB = callB.payload.scheduled_sessions as Array<Record<string, string>>
      assertEquals(sessionsA.length, 1)
      assertEquals(sessionsA[0].display_name, 'User A')
      assertEquals(sessionsB.length, 1)
      assertEquals(sessionsB[0].display_name, 'User B')

      // 4e. next_session reflects the first row of each gym independently
      const nextA = callA.payload.next_session as Record<string, string>
      const nextB = callB.payload.next_session as Record<string, string>
      assertEquals(nextA.display_name, 'User A')
      assertEquals(nextB.display_name, 'User B')

      teardown()
    },
  )

  await t.step('per-gym RPC failure does not abort other gyms', async () => {
    setup()
    configureGymList([GYM_A_ID, GYM_B_ID])
    // gym A errors at the RPC layer, gym B succeeds.
    mockState.rpcFns.set('get_display_idle_sessions', (params) => {
      const gymId = params.p_gym_id as string
      if (gymId === GYM_A_ID) {
        return { data: null, error: { message: 'rpc failed', code: 'X' } }
      }
      return {
        data: [
          {
            display_name: 'User B',
            session_name: 'Lower Body Strength',
            session_type: 'STRENGTH',
            day_label: 'Day 2 - Lower',
          },
        ],
        error: null,
      }
    })

    const res = await handler(new Request('http://localhost/test', { method: 'POST' }))
    const { status, body } = await parseJson(res)
    const summary = body as { published: boolean; gym_count: number; total_sessions: number }

    // The handler returns 502 (partial failure) but still broadcasts the
    // gym B payload. The per-gym error is captured under `failures`.
    assertEquals(status, 502)
    assertEquals(summary.published, false)
    assertEquals(summary.gym_count, 2)

    // Only gym B made it through to a broadcast POST. Gym A's RPC failed
    // before the fetch was reached.
    assertEquals(spy.calls.length, 1)
    assertEquals(spy.calls[0].topic, `realtime:display:gym:${GYM_B_ID}`)

    teardown()
  })

  await t.step('returns 502 when broadcast POST fails for one gym', async () => {
    setup()
    configureGymList([GYM_A_ID, GYM_B_ID])
    configurePerGymRpc({
      [GYM_A_ID]: [
        {
          display_name: 'User A',
          session_name: 'Upper Body',
          session_type: 'STRENGTH',
          day_label: 'Day 1',
        },
      ],
      [GYM_B_ID]: [
        {
          display_name: 'User B',
          session_name: 'Lower Body',
          session_type: 'STRENGTH',
          day_label: 'Day 2',
        },
      ],
    })
    spy.failOne(GYM_A_ID)

    const res = await handler(new Request('http://localhost/test', { method: 'POST' }))
    const { status, body } = await parseJson(res)
    const summary = body as { published: boolean; gym_count: number; total_sessions: number }

    assertEquals(status, 502)
    assertEquals(summary.published, false)
    assertEquals(summary.gym_count, 2)
    // Both broadcasts were attempted -- the loop does not short-circuit.
    assertEquals(spy.calls.length, 2)

    teardown()
  })

  // -------------------------------------------------------------------------
  // Empty schedule for a gym
  // -------------------------------------------------------------------------

  await t.step('broadcasts an empty payload for a gym with no scheduled sessions', async () => {
    setup()
    configureGymList([GYM_A_ID])
    configurePerGymRpc({
      [GYM_A_ID]: [],
    })

    const res = await handler(new Request('http://localhost/test', { method: 'POST' }))
    const { status, body } = await parseJson(res)
    const summary = body as { published: boolean; gym_count: number; total_sessions: number }

    assertEquals(status, 200)
    assertEquals(summary.published, true)
    assertEquals(summary.gym_count, 1)
    assertEquals(summary.total_sessions, 0)
    assertEquals(spy.calls.length, 1)

    const sessions = spy.calls[0].payload.scheduled_sessions as unknown[]
    const next = spy.calls[0].payload.next_session
    assertEquals(sessions.length, 0)
    assertEquals(next, null)

    teardown()
  })

  // -------------------------------------------------------------------------
  // Schema validation: malformed RPC rows are filtered out
  // -------------------------------------------------------------------------

  await t.step('filters out malformed RPC rows that miss required fields', async () => {
    setup()
    configureGymList([GYM_A_ID])
    mockState.rpcFns.set('get_display_idle_sessions', () => ({
      data: [
        // Valid row
        {
          display_name: 'User A',
          session_name: 'Upper',
          session_type: 'STRENGTH',
          day_label: 'Day 1',
        },
        // Missing fields -- should be filtered
        { display_name: 'Half Row' },
        // Wrong type -- should be filtered
        {
          display_name: 123,
          session_name: 'Upper',
          session_type: 'STRENGTH',
          day_label: 'Day 1',
        },
      ],
      error: null,
    }))

    const res = await handler(new Request('http://localhost/test', { method: 'POST' }))
    const { status, body } = await parseJson(res)
    const summary = body as { published: boolean; gym_count: number; total_sessions: number }

    assertEquals(status, 200)
    assertEquals(summary.total_sessions, 1)
    const sessions = spy.calls[0].payload.scheduled_sessions as unknown[]
    assertEquals(sessions.length, 1)

    teardown()
  })
})
