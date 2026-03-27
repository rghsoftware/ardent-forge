import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface UndoBannerProps {
  undoAction: { setId: string; expiresAt: number } | null
  onUndo: () => void
}

export function UndoBanner({ undoAction, onUndo }: UndoBannerProps) {
  // Start at 10 (matches the undo window). Updates async via timers.
  const [secondsLeft, setSecondsLeft] = useState(10)

  useEffect(() => {
    if (!undoAction) return

    const calcRemaining = () => Math.max(0, Math.ceil((undoAction.expiresAt - Date.now()) / 1000))

    // Async initial reset -- avoids synchronous setState in effect body
    const initial = setTimeout(() => setSecondsLeft(calcRemaining()), 0)
    const interval = setInterval(() => setSecondsLeft(calcRemaining()), 1000)

    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [undoAction])

  if (!undoAction || secondsLeft <= 0) return null

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 mx-4 mb-2 flex items-center justify-between bg-surface-iron px-4 py-3">
      <span className="text-xs uppercase tracking-wider text-warm-ash">SET CONFIRMED</span>
      <Button variant="ghost" size="sm" onClick={onUndo} className="text-xs text-ember">
        UNDO ({secondsLeft}S)
      </Button>
    </div>
  )
}
