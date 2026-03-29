import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/tracker')({
  beforeLoad: ({ context }) => {
    if (!context.auth.loading && !context.auth.user) {
      throw redirect({ to: '/sign-in' })
    }
  },
  component: TrackerPage,
})

function TrackerPage() {
  return (
    <div className="p-4 text-bone-white font-body">
      <h1 className="font-display text-industrial text-2xl mb-4">TRACKER</h1>
      <p className="text-warm-ash text-sm">Active workout session</p>
    </div>
  )
}
