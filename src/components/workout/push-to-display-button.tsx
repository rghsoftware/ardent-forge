import { useState } from 'react'

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

  const label = isFocused ? 'Return to board' : 'Push to display'
  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={label}
      title={label}
      aria-pressed={isFocused}
      className="flex h-12 w-12 items-center justify-center text-bone-white active:bg-surface-forge"
    >
      <span
        className={`material-symbols-outlined text-2xl ${isFocused ? 'text-ember' : 'text-bone-white'}`}
      >
        cast
      </span>
    </button>
  )
}
