import { useEffect } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { getSupabaseClient } from '@/lib/supabase'
import {
  getNotificationPreferences,
  isInQuietHours,
  sendSessionReminderNotification,
} from '@/lib/notification-service'

// Module-level: survives hook remounts, resets on full page reload
let _lastRemindedDate: string | null = null

export function useSessionReminderBrowser(): void {
  useEffect(() => {
    if (isTauri()) return

    async function checkAndMaybeNotify(): Promise<void> {
      try {
        const prefs = await getNotificationPreferences()

        // Guard: master toggle and session reminders toggle
        if (!prefs.enabled || !prefs.sessionReminders.enabled) return

        // Guard: quiet hours
        if (isInQuietHours(prefs)) return

        // Guard: only fire between 06:00 and 20:59 local time
        const currentHour = new Date().getHours()
        if (currentHour < 6 || currentHour > 20) return

        // Guard: already reminded today (local calendar date, not UTC)
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        if (_lastRemindedDate === today) return

        const supabase = getSupabaseClient()
        if (!supabase) {
          console.error('[session-reminder-browser] Supabase client not initialized')
          return
        }

        // 1. Get active program activation
        const { data: activation, error: activationErr } = await supabase
          .from('program_activations')
          .select('id, program_id, current_block_ordinal, current_week_number')
          .maybeSingle()

        if (activationErr) {
          console.error(
            '[session-reminder-browser] Failed to query program_activations:',
            activationErr,
          )
          return
        }
        if (!activation) return // No active program

        // 2. Find today's scheduled session for the current block+week position
        const { data: block, error: blockErr } = await supabase
          .from('blocks')
          .select('id')
          .eq('program_id', activation.program_id)
          .eq('ordinal', activation.current_block_ordinal)
          .maybeSingle()

        if (blockErr) {
          console.error('[session-reminder-browser] Failed to query blocks:', blockErr)
          return
        }
        if (!block) return

        // Get the block_week for current_week_number
        const { data: blockWeek, error: weekErr } = await supabase
          .from('block_weeks')
          .select('id')
          .eq('block_id', block.id)
          .eq('week_number', activation.current_week_number)
          .maybeSingle()

        if (weekErr) {
          console.error('[session-reminder-browser] Failed to query block_weeks:', weekErr)
          return
        }
        if (!blockWeek) return

        // Get scheduled sessions for today's day_of_week
        const todayDow = new Date().getDay() // 0=Sunday, matches schema
        const { data: sessions, error: sessErr } = await supabase
          .from('scheduled_sessions')
          .select('id, session_template_id, session_templates(name)')
          .eq('block_week_id', blockWeek.id)
          .eq('day_of_week', todayDow)

        if (sessErr) {
          console.error('[session-reminder-browser] Failed to query scheduled_sessions:', sessErr)
          return
        }
        if (!sessions || sessions.length === 0) return

        // 3. Check if a workout has been logged today
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const tomorrowStart = new Date(todayStart)
        tomorrowStart.setDate(tomorrowStart.getDate() + 1)

        const { data: todayLogs, error: logErr } = await supabase
          .from('workout_logs')
          .select('id')
          .gte('started_at', todayStart.toISOString())
          .lt('started_at', tomorrowStart.toISOString())
          .limit(1)

        if (logErr) {
          console.error('[session-reminder-browser] Failed to query workout_logs:', logErr)
          return
        }

        if (todayLogs && todayLogs.length > 0) {
          // Workout already logged -- suppress further checks today
          _lastRemindedDate = today
          return
        }

        // 4. Fire notification for the first scheduled session
        const session = sessions[0]
        const rawTemplate = session.session_templates as unknown as { name: string } | null
        if (!rawTemplate?.name) {
          console.warn(
            '[session-reminder-browser] session_templates join returned no name for session:',
            session.id,
          )
        }
        const sessionName = rawTemplate?.name ?? 'Workout'

        // Set the guard before firing so a notification failure does not cause
        // a Supabase query spam loop on the next poll interval.
        _lastRemindedDate = today
        await sendSessionReminderNotification(sessionName, prefs)
      } catch (err) {
        console.error('[session-reminder-browser] Unexpected error during poll:', err)
      }
    }

    // Run immediately on mount, then poll every 60s
    checkAndMaybeNotify()
    const interval = setInterval(checkAndMaybeNotify, 60_000)

    return () => clearInterval(interval)
  }, [])
}
