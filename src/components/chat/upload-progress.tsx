import { Icon } from '@/components/icon'

// ---------------------------------------------------------------------------
// UploadProgress -- compact progress bar shown during file upload
// ---------------------------------------------------------------------------

interface UploadProgressProps {
  progress: number
  filename: string
  onCancel: () => void
}

export function UploadProgress({ progress, filename, onCancel }: UploadProgressProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return (
    <div className="flex h-12 items-center gap-3 bg-surface-charcoal px-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-bone-white truncate" title={filename}>
            {filename}
          </span>
          <span className="text-warm-ash text-label-small shrink-0 ml-2">
            {Math.round(clampedProgress)}%
          </span>
        </div>
        <div className="h-1 w-full bg-surface-steel">
          <div
            className="h-full bg-ember transition-[width] duration-200"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="text-warm-ash shrink-0 hover:text-bone-white transition-colors"
        aria-label="Cancel upload"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  )
}
