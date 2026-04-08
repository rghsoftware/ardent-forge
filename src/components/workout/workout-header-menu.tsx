import { useState } from 'react'
import { MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface WorkoutHeaderMenuProps {
  isBroadcasting: boolean
  publishFocus: () => void
  publishUnfocus: () => void
}

/**
 * Overflow menu for the active-workout header. Hosts infrequent actions
 * (push to display, future session tools) so the header stays focused on
 * timer + pause.
 *
 * Renders nothing when there are no items to show, so the header collapses
 * cleanly when no displays are broadcasting.
 */
export function WorkoutHeaderMenu({
  isBroadcasting,
  publishFocus,
  publishUnfocus,
}: WorkoutHeaderMenuProps) {
  const [isFocusedOnDisplay, setIsFocusedOnDisplay] = useState(false)

  if (!isBroadcasting) return null

  const handleToggleDisplay = () => {
    if (isFocusedOnDisplay) {
      publishUnfocus()
      setIsFocusedOnDisplay(false)
    } else {
      publishFocus()
      setIsFocusedOnDisplay(true)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Workout menu"
          className="flex h-12 w-12 items-center justify-center text-bone-white active:bg-surface-forge"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuItem onSelect={handleToggleDisplay}>
          <span
            className={`material-symbols-outlined text-base ${
              isFocusedOnDisplay ? 'text-ember' : ''
            }`}
          >
            cast
          </span>
          {isFocusedOnDisplay ? 'Return to board' : 'Push to display'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
