import { X } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  onDismiss: () => void
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-alarm-red px-4 py-2 text-on-alarm"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest">Error</span>
        <span className="truncate text-sm">{message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="flex h-8 w-8 shrink-0 items-center justify-center text-on-alarm active:bg-on-alarm/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
