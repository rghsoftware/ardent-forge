import { useState } from 'react'
import { usePrograms, useAssignProgram } from '@/hooks/use-programs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { GroupMember, Program } from '@/domain/types'

interface AssignProgramDialogProps {
  member: GroupMember
  groupId: string
  coachUserId: string
  trigger: React.ReactNode
}

/**
 * Two-step dialog for assigning a coach's program to a group member.
 *
 * Step 1: Browse and select from the coach's assignable programs.
 * Step 2: Confirm the assignment before executing the mutation.
 */
export function AssignProgramDialog({
  member,
  groupId,
  coachUserId,
  trigger,
}: AssignProgramDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: programs, isLoading: programsLoading } = usePrograms(coachUserId)
  const assignProgram = useAssignProgram()

  // Filter to only the coach's own assignable programs:
  // - Must belong to the coach (userId === coachUserId)
  // - Exclude programs that were assigned TO the coach by someone else
  //   (source === COACH_ASSIGNED and createdBy !== coachUserId)
  const assignablePrograms =
    programs?.filter(
      (p: Program) =>
        p.userId === coachUserId && !(p.source === 'COACH_ASSIGNED' && p.createdBy !== coachUserId),
    ) ?? []

  const selectedProgram = assignablePrograms.find((p: Program) => p.id === selectedProgramId)

  const memberDisplayName = `${member.userId.slice(0, 8)}...`

  const resetState = () => {
    setSelectedProgramId(null)
    setConfirming(false)
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState()
    setOpen(next)
  }

  const handleSelectProgram = (programId: string) => {
    setSelectedProgramId(programId)
    setConfirming(true)
    setError(null)
  }

  const handleBack = () => {
    setSelectedProgramId(null)
    setConfirming(false)
    setError(null)
  }

  const handleConfirm = async () => {
    if (!selectedProgramId) return

    setError(null)
    try {
      await assignProgram.mutateAsync({
        programId: selectedProgramId,
        memberId: member.userId,
        groupId,
      })
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign program.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="bg-surface-iron border-ghost-line/15">
        <DialogHeader>
          <DialogTitle className="font-heading text-bone-white">
            {confirming && selectedProgram
              ? 'Confirm assignment'
              : `Assign Program to ${memberDisplayName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6">
          {/* Step 1: Program list */}
          {!confirming && (
            <>
              {programsLoading && (
                <p className="text-sm text-warm-ash py-4 text-center">Loading programs...</p>
              )}

              {!programsLoading && assignablePrograms.length === 0 && (
                <p className="text-sm text-warm-ash py-4 text-center">
                  No programs available to assign. Create a program first.
                </p>
              )}

              {!programsLoading && assignablePrograms.length > 0 && (
                <ul className="flex flex-col gap-1" role="listbox" aria-label="Select a program">
                  {assignablePrograms.map((program: Program) => (
                    <li key={program.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        className="w-full text-left px-4 py-3 bg-surface-gunmetal hover:bg-surface-steel/20 transition-colors cursor-pointer"
                        onClick={() => handleSelectProgram(program.id)}
                      >
                        <span className="block text-sm text-bone-white font-medium">
                          {program.name}
                        </span>
                        <span className="block text-xs text-warm-ash/70 mt-0.5">
                          {program.durationWeeks
                            ? `${program.durationWeeks} week${program.durationWeeks !== 1 ? 's' : ''}`
                            : 'No duration set'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Step 2: Confirmation */}
          {confirming && selectedProgram && (
            <>
              <p className="text-sm text-bone-white py-2">
                Assign <span className="font-semibold text-ember">{selectedProgram.name}</span> to{' '}
                <span className="font-semibold">{memberDisplayName}</span>?
              </p>

              {error && <p className="text-xs text-warning-flare">{error}</p>}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  disabled={assignProgram.isPending}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={assignProgram.isPending}
                >
                  {assignProgram.isPending ? 'Assigning...' : 'Confirm'}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
