import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface PushToDisplayButtonProps {
  userId: string
  publishFocus: () => void
  publishUnfocus: () => void
  isBroadcasting: boolean
}

export function PushToDisplayButton({
  userId: _userId,
  publishFocus,
  publishUnfocus,
  isBroadcasting,
}: PushToDisplayButtonProps) {
  const [isFocused, setIsFocused] = useState(false)

  if (!isBroadcasting) return null

  function handleToggle() {
    if (isFocused) {
      publishUnfocus()
      setIsFocused(false)
    } else {
      publishFocus()
      setIsFocused(true)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      className="min-h-12 min-w-12 gap-2"
    >
      <span
        className={`material-symbols-outlined text-xl ${isFocused ? 'text-ember' : 'text-warm-ash'}`}
      >
        cast
      </span>
      <span className="text-xs font-medium">
        {isFocused ? 'Return to Board' : 'Push to Display'}
      </span>
    </Button>
  )
}
