import type { MediaStatus } from '@/domain/types'
import { Icon } from '@/components/icon'

// ---------------------------------------------------------------------------
// MediaStatusIndicator -- shows processing/failed state for media attachments
// ---------------------------------------------------------------------------

interface MediaStatusIndicatorProps {
  status: MediaStatus
  onRetry?: () => void
}

export function MediaStatusIndicator({ status, onRetry }: MediaStatusIndicatorProps) {
  return (
    <div className="aspect-video w-full bg-surface-charcoal flex flex-col items-center justify-center gap-2">
      {status === 'processing' && (
        <>
          <div className="h-8 w-24 bg-surface-steel animate-[pulse-media_1.5s_ease-in-out_infinite]" />
          <span className="text-warm-ash text-xs">Processing...</span>
        </>
      )}

      {status === 'failed' && (
        <>
          <Icon name="error" size={32} className="text-red-500" />
          <span className="text-warm-ash text-xs">Failed</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-ember text-xs hover:text-ember/80 transition-colors"
            >
              Retry
            </button>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse-media {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
