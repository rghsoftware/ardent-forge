import { isTauri } from '@tauri-apps/api/core'
import { useNotificationPreferences } from '@/hooks/use-notification-preferences'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { NotificationPreferences } from '@/domain/types/notification'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format hour:minute as HH:MM for input[type="time"] */
function toTimeString(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** Parse HH:MM string into { hour, minute } */
function parseTimeString(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(':').map(Number)
  return { hour: h ?? 0, minute: m ?? 0 }
}

const ADVANCE_MINUTE_OPTIONS = [
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '45', label: '45 minutes before' },
  { value: '60', label: '60 minutes before' },
]

// ---------------------------------------------------------------------------
// Subsection label -- reusable within this component
// ---------------------------------------------------------------------------

function SubsectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-sans text-[11px] font-medium uppercase tracking-widest text-warm-ash/70">
      {children}
    </h3>
  )
}

// ---------------------------------------------------------------------------
// NotificationSettings
// ---------------------------------------------------------------------------

export function NotificationSettings() {
  const { data: prefs, isLoading, updatePreferences } = useNotificationPreferences()

  const isBrowser = !isTauri()

  // Merge helper: shallow-merge updated fields with current prefs and persist
  const update = (patch: Partial<NotificationPreferences>) => {
    if (!prefs) return
    const next: NotificationPreferences = { ...prefs, ...patch }
    updatePreferences.mutate(next)
  }

  // Request browser notification permission when master toggle turns on
  const handleMasterToggle = (checked: boolean) => {
    if (checked && isBrowser && 'Notification' in window) {
      Notification.requestPermission().catch(() => {
        // Permission request is best-effort in browser mode
      })
    }
    update({ enabled: checked })
  }

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (isLoading || !prefs) {
    return (
      <div className="mt-4 space-y-4">
        <Skeleton className="h-12 w-full rounded-none bg-surface-gunmetal" />
        <Skeleton className="h-12 w-full rounded-none bg-surface-gunmetal" />
        <Skeleton className="h-12 w-full rounded-none bg-surface-gunmetal" />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mt-4 space-y-5">
      {/* Master toggle */}
      <ToggleRow
        label="Notifications"
        checked={prefs.enabled}
        onCheckedChange={handleMasterToggle}
      />

      {/* Conditional subsections -- only shown when master toggle is on */}
      {prefs.enabled && (
        <div className="space-y-5 border-l-2 border-surface-steel pl-4">
          {/* REST TIMER ALERTS */}
          <div className="space-y-2">
            <SubsectionHeader>Rest timer alerts</SubsectionHeader>
            <ToggleRow
              label="Enabled"
              checked={prefs.restTimer.enabled}
              onCheckedChange={(checked) =>
                update({ restTimer: { ...prefs.restTimer, enabled: checked } })
              }
            />
            <p className="text-[11px] leading-relaxed text-warm-ash/60">
              Always delivered during active workouts
            </p>
          </div>

          {/* SESSION REMINDERS */}
          <div className="space-y-2">
            <SubsectionHeader>Session reminders</SubsectionHeader>
            <ToggleRow
              label="Enabled"
              checked={prefs.sessionReminders.enabled}
              onCheckedChange={(checked) =>
                update({ sessionReminders: { ...prefs.sessionReminders, enabled: checked } })
              }
            />
            {prefs.sessionReminders.enabled && (
              <div className="pt-1">
                <Select
                  value={String(prefs.sessionReminders.advanceMinutes)}
                  onValueChange={(val) =>
                    update({
                      sessionReminders: {
                        ...prefs.sessionReminders,
                        advanceMinutes: Number(val),
                      },
                    })
                  }
                >
                  <SelectTrigger className="min-h-[48px] w-full border-surface-steel bg-surface-gunmetal text-bone-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-iron text-bone-white">
                    {ADVANCE_MINUTE_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="min-h-[44px] focus:bg-surface-gunmetal"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isBrowser && (
              <p className="text-[11px] leading-relaxed text-warm-ash/60">
                Session reminders require the desktop app
              </p>
            )}
          </div>

          {/* PR CELEBRATIONS */}
          <div className="space-y-2">
            <SubsectionHeader>PR celebrations</SubsectionHeader>
            <ToggleRow
              label="Enabled"
              checked={prefs.prCelebrations.enabled}
              onCheckedChange={(checked) => update({ prCelebrations: { enabled: checked } })}
            />
          </div>

          {/* QUIET HOURS */}
          <div className="space-y-2">
            <SubsectionHeader>Quiet hours</SubsectionHeader>
            <ToggleRow
              label="Enabled"
              checked={prefs.quietHours.enabled}
              onCheckedChange={(checked) =>
                update({ quietHours: { ...prefs.quietHours, enabled: checked } })
              }
            />
            {prefs.quietHours.enabled && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="font-sans text-xs font-medium text-warm-ash">Start</label>
                  <input
                    type="time"
                    value={toTimeString(prefs.quietHours.startHour, prefs.quietHours.startMinute)}
                    onChange={(e) => {
                      const { hour, minute } = parseTimeString(e.target.value)
                      update({
                        quietHours: {
                          ...prefs.quietHours,
                          startHour: hour,
                          startMinute: minute,
                        },
                      })
                    }}
                    className="min-h-[48px] w-full rounded-none border border-surface-steel bg-surface-gunmetal px-3 font-mono text-sm text-bone-white outline-none focus:border-forge"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-sans text-xs font-medium text-warm-ash">End</label>
                  <input
                    type="time"
                    value={toTimeString(prefs.quietHours.endHour, prefs.quietHours.endMinute)}
                    onChange={(e) => {
                      const { hour, minute } = parseTimeString(e.target.value)
                      update({
                        quietHours: {
                          ...prefs.quietHours,
                          endHour: hour,
                          endMinute: minute,
                        },
                      })
                    }}
                    className="min-h-[48px] w-full rounded-none border border-surface-steel bg-surface-gunmetal px-3 font-mono text-sm text-bone-white outline-none focus:border-forge"
                  />
                </div>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-warm-ash/60">
              Rest timer alerts are always delivered
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ToggleRow -- label + switch in a flex row, 48px+ touch target
// ---------------------------------------------------------------------------

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3">
      <span className="font-sans text-sm text-bone-white">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}
