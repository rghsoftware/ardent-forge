import { useCallback } from 'react'
import { Icon } from '@/components/icon'

// ---------------------------------------------------------------------------
// ImageLightbox -- full-screen image overlay with close on backdrop tap
// ---------------------------------------------------------------------------

interface ImageLightboxProps {
  imageUrl: string
  onClose: () => void
}

export function ImageLightbox({ imageUrl, onClose }: ImageLightboxProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-pit/90"
      onClick={handleBackdropClick}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-bone-white hover:text-warm-ash transition-colors z-10"
        aria-label="Close image viewer"
      >
        <Icon name="close" size={28} />
      </button>

      <img
        src={imageUrl}
        alt="Full-size image"
        className="max-h-[90vh] max-w-[90vw] object-contain"
        style={{ touchAction: 'pinch-zoom' }}
      />
    </div>
  )
}
