import { Icon } from '@/components/icon'
import { Button } from '@/components/ui/button'
import type { EventMetadata } from '@/domain/types'
import { PackingList } from './packing-list'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventDetailProps {
  templateId?: string
  workoutLogId?: string
  eventMetadata: EventMetadata
  interactive?: boolean
  onEdit?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventDate(isoDate: string | undefined): string | null {
  if (!isoDate) return null
  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

// ---------------------------------------------------------------------------
// EventDetail -- main read-only event detail view
// ---------------------------------------------------------------------------

export function EventDetail({
  templateId,
  workoutLogId,
  eventMetadata,
  interactive = false,
  onEdit,
}: EventDetailProps) {
  const parentId = templateId || workoutLogId
  const parentType: 'template' | 'log' = templateId ? 'template' : 'log'

  const formattedDate = formatEventDate(eventMetadata.eventDate)
  const hasCoordinates = eventMetadata.latitude != null && eventMetadata.longitude != null

  return (
    <div className="space-y-6 p-4">
      {/* Header: event name placeholder + countdown badge slot */}
      {/* Note: event name comes from the parent template/log; countdown badge deferred to S013 */}

      {/* Date row */}
      <div>
        <span className="text-xs tracking-widest text-warm-ash">DATE</span>
        <p className="text-bone-white">{formattedDate || 'TBD'}</p>
      </div>

      {/* Location row */}
      {eventMetadata.location && (
        <div>
          <span className="text-xs tracking-widest text-warm-ash">LOCATION</span>
          {hasCoordinates ? (
            <a
              href={`https://maps.google.com/?q=${eventMetadata.latitude},${eventMetadata.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-ember hover:underline"
            >
              <Icon name="location_on" size={16} />
              {eventMetadata.location}
            </a>
          ) : (
            <p className="text-bone-white">{eventMetadata.location}</p>
          )}
        </div>
      )}

      {/* URL row */}
      {eventMetadata.eventUrl && (
        <div>
          <span className="text-xs tracking-widest text-warm-ash">EVENT URL</span>
          <a
            href={eventMetadata.eventUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 truncate text-ember hover:underline"
          >
            <Icon name="open_in_new" size={16} />
            {safeHostname(eventMetadata.eventUrl)}
          </a>
        </div>
      )}

      {/* Requirements card */}
      {eventMetadata.requirements.length > 0 && (
        <div className="bg-surface-iron p-4">
          <h3 className="mb-3 text-xs font-medium tracking-widest text-warm-ash">REQUIREMENTS</h3>
          {eventMetadata.requirements.map((req, i) => (
            <div key={i} className="flex justify-between py-1">
              <span className="text-warm-ash">{req.key}</span>
              <span className="text-bone-white">
                {req.value}
                {req.unit ? ` ${req.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Packing list */}
      {parentId && (
        <PackingList parentId={parentId} parentType={parentType} interactive={interactive} />
      )}

      {/* Edit button */}
      {onEdit && (
        <Button
          variant="outline"
          className="min-h-12 w-full text-xs uppercase tracking-wider"
          onClick={onEdit}
        >
          EDIT EVENT
        </Button>
      )}
    </div>
  )
}
