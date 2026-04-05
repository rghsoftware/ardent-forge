import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$templateId')({
  component: EventDetailPage,
})

function EventDetailPage() {
  const { templateId } = Route.useParams()
  return (
    <div className="min-h-screen bg-surface-anvil pb-20">
      <div className="flex items-center justify-between px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-medium text-bone-white">Event</h1>
      </div>
      <div className="px-4">
        <p className="text-sm text-warm-ash">Template ID: {templateId}</p>
      </div>
    </div>
  )
}
