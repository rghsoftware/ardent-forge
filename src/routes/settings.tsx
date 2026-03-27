import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="p-4 text-bone-white font-body">
      <h1 className="font-display text-industrial text-2xl mb-4">SETTINGS</h1>
      <p className="text-warm-ash text-sm">User settings and preferences</p>
    </div>
  )
}
