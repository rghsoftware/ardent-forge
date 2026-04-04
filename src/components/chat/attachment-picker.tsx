import { useRef, useState } from 'react'
import { Icon } from '@/components/icon'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { validateFile } from '@/lib/media-constraints'
import type { MediaType } from '@/domain/types'

interface AttachmentPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelected: (file: File, type: MediaType) => void
  isOnline: boolean
}

const OFFLINE_MESSAGE = 'Requires internet connection'

export function AttachmentPicker({
  open,
  onOpenChange,
  onFileSelected,
  isOnline,
}: AttachmentPickerProps) {
  const videoInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: MediaType) => {
    const file = e.target.files?.[0]
    // Reset the input so the same file can be re-selected
    e.target.value = ''
    if (!file) return

    const result = await validateFile(file, type)
    if (!result.valid) {
      setError(result.error)
      return
    }

    setError(null)
    onOpenChange(false)
    onFileSelected(file, type)
  }

  const handleOptionClick = (type: 'video' | 'photo' | 'file' | 'workout') => {
    if (type === 'workout') {
      alert('Workout: Coming soon')
      onOpenChange(false)
      return
    }

    if (!isOnline) return

    setError(null)

    if (type === 'video') videoInputRef.current?.click()
    else if (type === 'photo') photoInputRef.current?.click()
    else fileInputRef.current?.click()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setError(null)
    onOpenChange(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="bg-surface-charcoal pb-8">
        <SheetHeader>
          <SheetTitle className="text-bone-white">Attach</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 px-4">
          <OptionButton
            icon="videocam"
            label="Video"
            disabled={!isOnline}
            disabledMessage={OFFLINE_MESSAGE}
            onClick={() => handleOptionClick('video')}
          />

          <OptionButton
            icon="photo_camera"
            label="Photo"
            disabled={!isOnline}
            disabledMessage={OFFLINE_MESSAGE}
            onClick={() => handleOptionClick('photo')}
          />

          <OptionButton
            icon="fitness_center"
            label="Workout"
            onClick={() => handleOptionClick('workout')}
          />

          <OptionButton
            icon="description"
            label="File"
            disabled={!isOnline}
            disabledMessage={OFFLINE_MESSAGE}
            onClick={() => handleOptionClick('file')}
          />
        </div>

        {error && <p className="mt-3 px-4 text-center font-body text-sm text-red-400">{error}</p>}

        {/* Hidden file inputs */}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileChange(e, 'video')}
        />
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => handleFileChange(e, 'image')}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
          className="hidden"
          onChange={(e) => handleFileChange(e, 'file')}
        />
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// OptionButton -- individual attachment option in the grid
// ---------------------------------------------------------------------------

function OptionButton({
  icon,
  label,
  disabled,
  disabledMessage,
  onClick,
}: {
  icon: string
  label: string
  disabled?: boolean
  disabledMessage?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 bg-surface-steel p-4 text-warm-ash transition-colors hover:bg-surface-steel/80 hover:text-bone-white active:bg-surface-iron disabled:opacity-50 disabled:hover:bg-surface-steel disabled:hover:text-warm-ash"
    >
      <Icon name={icon} size={28} />
      <span className="font-body text-sm">{label}</span>
      {disabled && disabledMessage && (
        <span className="font-body text-xs text-warm-ash/70">{disabledMessage}</span>
      )}
    </button>
  )
}
