/**
 * seed-display.ts -- Broadcast mock display events to test all display modes.
 *
 * Usage:
 *   bun scripts/seed-display.ts [mode]
 *
 * Modes:
 *   idle     - Sends an idle_snapshot with scheduled sessions (default after clearing)
 *   board    - Sends 2-5 workout_snapshot events (board view)
 *   focused  - Sends 1 workout_snapshot + a focus event (focused view)
 *   full     - Runs idle -> board -> focused -> unfocus -> end in sequence with delays
 *   clear    - Sends session_ended for all mock users
 *
 * The script connects to local Supabase and broadcasts on the 'display' channel,
 * matching the same channel the display page subscribes to.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_KEY = process.env.SUPABASE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

const client = createClient(SUPABASE_URL, SUPABASE_KEY)

const channel = client.channel('display', {
  config: { broadcast: { ack: true, self: true } },
})

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_USERS = [
  { id: 'user-001', name: 'Alex' },
  { id: 'user-002', name: 'Jordan' },
  { id: 'user-003', name: 'Casey' },
  { id: 'user-004', name: 'Morgan' },
  { id: 'user-005', name: 'Riley' },
]

const EXERCISES = [
  'Barbell Back Squat',
  'Bench Press',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Front Squat',
  'Incline Dumbbell Press',
  'Romanian Deadlift',
]

const SESSION_TYPES = ['STRENGTH', 'CONDITIONING', 'MIXED'] as const

function makeSnapshot(userIdx: number, exerciseIdx = 0, completedSets = 1) {
  const user = MOCK_USERS[userIdx]
  const exercise = EXERCISES[(userIdx + exerciseIdx) % EXERCISES.length]
  const totalSets = 4
  const sets = Array.from({ length: totalSets }, (_, i) => ({
    set_number: i + 1,
    prescribed: { reps: 8, weight: { value: 135 + userIdx * 10, unit: 'lb' as const } },
    actual:
      i < completedSets
        ? { reps: 8, weight: { value: 135 + userIdx * 10, unit: 'lb' as const } }
        : undefined,
    completed: i < completedSets,
  }))

  return {
    user_id: user.id,
    display_name: user.name,
    session_name: `Week 4 Day ${userIdx + 1}`,
    workout_started_at: new Date(Date.now() - (15 + userIdx * 5) * 60_000).toISOString(),
    current_exercise: exercise,
    exercise_index: exerciseIdx,
    total_exercises: 5,
    sets,
    rest_timer:
      completedSets < totalSets
        ? {
            state: 'running' as const,
            started_at: new Date(Date.now() - 45_000).toISOString(),
            total_seconds: 90,
          }
        : { state: 'idle' as const },
    session_type: SESSION_TYPES[userIdx % SESSION_TYPES.length],
    is_visible: true as const,
  }
}

function makeIdleSnapshot() {
  return {
    server_time: new Date().toISOString(),
    scheduled_sessions: [
      {
        display_name: 'Alex',
        session_name: 'Upper Body A',
        session_type: 'STRENGTH',
        day_label: 'Day 1',
      },
      {
        display_name: 'Jordan',
        session_name: 'Lower Body A',
        session_type: 'STRENGTH',
        day_label: 'Day 2',
      },
      {
        display_name: 'Casey',
        session_name: 'Conditioning',
        session_type: 'CONDITIONING',
        day_label: 'Day 3',
      },
    ],
    next_session: { display_name: 'Alex', session_name: 'Upper Body A' },
  }
}

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

async function send(event: string, payload: unknown) {
  const result = await channel.send({ type: 'broadcast', event, payload })
  if (result !== 'ok') {
    console.error(`  Failed to send ${event}:`, result)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Mode handlers
// ---------------------------------------------------------------------------

async function sendIdle() {
  console.log('Sending idle_snapshot...')
  await send('idle_snapshot', makeIdleSnapshot())
  console.log('  Idle snapshot sent (3 scheduled sessions + next up)')
}

async function sendBoard(count = 3) {
  const n = Math.min(count, MOCK_USERS.length)
  console.log(`Sending ${n} workout snapshots (board view)...`)
  for (let i = 0; i < n; i++) {
    const completedSets = (i % 3) + 1
    await send('workout_snapshot', makeSnapshot(i, i % 3, completedSets))
    console.log(
      `  Sent snapshot for ${MOCK_USERS[i].name} (exercise ${(i % 3) + 1}, ${completedSets} sets done)`,
    )
  }
}

async function sendFocused() {
  console.log('Sending 1 snapshot + focus event (focused view)...')
  await send('workout_snapshot', makeSnapshot(0, 2, 2))
  await send('focus', { user_id: MOCK_USERS[0].id })
  console.log(`  Focused on ${MOCK_USERS[0].name}`)
}

async function sendClear() {
  console.log('Clearing all mock sessions...')
  for (const user of MOCK_USERS) {
    await send('session_ended', { user_id: user.id })
  }
  await send('unfocus', {})
  console.log('  All sessions cleared')
}

async function sendFull() {
  console.log('=== Full demo sequence ===\n')

  await sendIdle()
  console.log('\n  Waiting 5s...\n')
  await sleep(5_000)

  await sendBoard(4)
  console.log('\n  Waiting 6s...\n')
  await sleep(6_000)

  // Update some snapshots (simulate progress)
  console.log('Updating snapshots (progress)...')
  await send('workout_snapshot', makeSnapshot(0, 1, 3))
  await send('workout_snapshot', makeSnapshot(1, 2, 2))
  console.log('\n  Waiting 4s...\n')
  await sleep(4_000)

  await send('focus', { user_id: MOCK_USERS[0].id })
  console.log('Focused on Alex')
  console.log('\n  Waiting 6s...\n')
  await sleep(6_000)

  await send('unfocus', {})
  console.log('Unfocused -- back to board')
  console.log('\n  Waiting 4s...\n')
  await sleep(4_000)

  await sendClear()
  console.log('\n  Waiting 3s...\n')
  await sleep(3_000)

  await sendIdle()
  console.log('\n=== Demo complete ===')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const mode = process.argv[2] ?? 'full'

channel.subscribe(async (status) => {
  if (status !== 'SUBSCRIBED') return

  console.log(`Connected to display channel. Mode: ${mode}\n`)

  switch (mode) {
    case 'idle':
      await sendIdle()
      break
    case 'board':
      await sendBoard(Number(process.argv[3]) || 3)
      break
    case 'focused':
      await sendBoard(1)
      await sendFocused()
      break
    case 'full':
      await sendFull()
      break
    case 'clear':
      await sendClear()
      break
    default:
      console.error(`Unknown mode: ${mode}. Use: idle | board | focused | full | clear`)
  }

  console.log('\nDone. Exiting in 2s...')
  await sleep(2_000)
  await client.removeChannel(channel)
  process.exit(0)
})
