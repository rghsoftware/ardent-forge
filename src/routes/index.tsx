import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: ForgePage,
})

function ForgePage() {
  return (
    <div className="p-4 text-bone-white font-body">
      <h1 className="font-display text-industrial text-2xl mb-4">FORGE</h1>
      <p className="text-warm-ash text-sm">Today's programmed session</p>
    </div>
  )
}
