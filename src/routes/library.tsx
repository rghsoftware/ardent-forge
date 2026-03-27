import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/library')({
  component: LibraryPage,
})

function LibraryPage() {
  return (
    <div className="p-4 text-bone-white font-body">
      <h1 className="font-display text-industrial text-2xl mb-4">LIBRARY</h1>
      <p className="text-warm-ash text-sm">Program library</p>
    </div>
  )
}
