import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/builder')({
  component: BuilderPage,
})

function BuilderPage() {
  return (
    <div className="p-4 text-bone-white font-body">
      <h1 className="font-display text-industrial text-2xl mb-4">PROGRAM BUILDER</h1>
      <p className="text-warm-ash text-sm">Program builder (desktop)</p>
    </div>
  )
}
