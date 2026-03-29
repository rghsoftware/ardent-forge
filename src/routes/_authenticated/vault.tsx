import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/vault')({
  component: VaultPage,
})

function VaultPage() {
  return (
    <div className="p-4 text-bone-white font-body">
      <h1 className="font-display text-industrial text-2xl mb-4">VAULT</h1>
      <p className="text-warm-ash text-sm">Analytics and 1RM tracking</p>
    </div>
  )
}
