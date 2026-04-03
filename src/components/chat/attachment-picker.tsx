import { Icon } from '@/components/icon'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface AttachmentPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ATTACHMENT_OPTIONS = [
  { icon: 'videocam', label: 'Video' },
  { icon: 'photo_camera', label: 'Photo' },
  { icon: 'fitness_center', label: 'Workout' },
  { icon: 'description', label: 'File' },
] as const

export function AttachmentPicker({ open, onOpenChange }: AttachmentPickerProps) {
  const handleSelect = (label: string) => {
    alert(`${label}: Coming soon`)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-surface-charcoal pb-8">
        <SheetHeader>
          <SheetTitle className="text-bone-white">Attach</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 px-4">
          {ATTACHMENT_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => handleSelect(option.label)}
              className="flex flex-col items-center gap-2 bg-surface-steel p-4 text-warm-ash transition-colors hover:bg-surface-steel/80 hover:text-bone-white active:bg-surface-iron"
            >
              <Icon name={option.icon} size={28} />
              <span className="font-body text-sm">{option.label}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
