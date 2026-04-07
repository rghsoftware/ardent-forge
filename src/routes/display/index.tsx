import { createFileRoute } from '@tanstack/react-router'

// ---------------------------------------------------------------------------
// Legacy /display route -- static "not configured" page (F018 S6)
//
// This route is intentionally minimal. It does NOT create a Supabase client,
// does NOT open a channel, and does NOT depend on any runtime config. The
// gym-scoped display now lives at /display/gym/$gymId.
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/display/')({
  component: DisplayNotConfiguredPage,
})

function DisplayNotConfiguredPage() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-surface-anvil">
      <div className="max-w-xl px-6 text-center">
        <p className="font-display text-3xl tracking-widest text-ember">DISPLAY NOT CONFIGURED</p>
        <p className="mt-6 text-sm uppercase tracking-wider text-warm-ash">
          Ask the gym owner for the display URL.
        </p>
        <p className="mt-2 text-xs uppercase tracking-wider text-warm-ash/70">
          Expected format: /display/gym/&lt;gym-id&gt;
        </p>
      </div>
    </div>
  )
}
