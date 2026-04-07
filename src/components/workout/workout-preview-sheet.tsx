import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { SESSION_TYPE_BADGE } from '@/components/program-builder/constants'
import { SessionTemplatePreview } from '@/components/workout/session-template-preview'
import { useSessionTemplateFull } from '@/hooks/use-session-template-full'
import type { SessionType } from '@/domain/types'

export interface WorkoutPreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionTemplateId: string | null
  onStart?: () => void
}

/**
 * WorkoutPreviewSheet -- modal preview of a session template, used by the
 * program builder. The Forge page now renders SessionTemplatePreview inline
 * inside ProgramSessionCard instead of opening this sheet.
 */
export function WorkoutPreviewSheet({
  open,
  onOpenChange,
  sessionTemplateId,
  onStart,
}: WorkoutPreviewSheetProps) {
  // Subscribe to the same shared query so the header renders the template name.
  const {
    data: templateFull,
    isLoading,
    isError,
  } = useSessionTemplateFull(open ? sessionTemplateId : null)

  const handleStart = () => {
    onStart?.()
    onOpenChange(false)
  }

  const sessionType = (templateFull?.template.category ?? 'STRENGTH') as SessionType

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[90vh] flex-col gap-0 rounded-none border-t border-warm-ash/10 bg-surface-anvil p-0 text-bone-white"
      >
        <SheetHeader className="gap-2 border-b border-warm-ash/10 bg-surface-pit p-4">
          <div className="flex items-center gap-2">
            <SheetTitle className="font-display text-base font-medium uppercase tracking-wider text-bone-white">
              {templateFull?.template.name ?? 'Workout Preview'}
            </SheetTitle>
            {templateFull && (
              <span
                className={`px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                  SESSION_TYPE_BADGE[sessionType] ?? 'bg-surface-steel text-warm-ash'
                }`}
              >
                {sessionType}
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <SessionTemplatePreview sessionTemplateId={sessionTemplateId} enabled={open} />
        </div>

        {onStart && (
          <SheetFooter className="mt-0 gap-0 border-t border-warm-ash/10 bg-surface-pit p-4">
            <Button
              onClick={handleStart}
              disabled={!templateFull || isLoading || isError}
              className="h-12 w-full rounded-none bg-ember font-display text-sm font-medium uppercase tracking-wider text-surface-pit hover:bg-ember/90"
            >
              Start Workout
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
