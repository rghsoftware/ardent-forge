import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { useAuth } from '@/lib/auth'
import { useCloneProgram } from '@/hooks/use-share-links'
import { mapRpcToProgramFull } from '@/lib/share-rpc-mapper'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CloneProgramButtonProps {
  programData: unknown
}

export function CloneProgramButton({ programData }: CloneProgramButtonProps) {
  const { user, isGuest } = useAuth()
  const navigate = useNavigate()
  const cloneMutation = useCloneProgram()
  const [cloneSuccess, setCloneSuccess] = useState(false)

  const isAuthenticated = !!user && !isGuest

  const handleClone = async () => {
    if (!user || isGuest) return

    try {
      const programFull = mapRpcToProgramFull(programData)
      await cloneMutation.mutateAsync({ program: programFull, userId: user.id })
      setCloneSuccess(true)
      // Navigate to library after a brief moment to show the success state
      setTimeout(() => {
        navigate({ to: '/library' })
      }, 1200)
    } catch (err) {
      console.error('[clone] Failed to clone program:', err)
    }
  }

  const handleSignIn = () => {
    navigate({ to: '/sign-in', search: { reason: undefined, returnTo: window.location.pathname } })
  }

  if (cloneSuccess) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="flex items-center gap-2 text-ember">
          <Icon name="check_circle" size={20} fill />
          <span className="font-display text-sm font-medium uppercase tracking-wider">
            Program cloned to library
          </span>
        </div>
        <span className="text-xs text-warm-ash/60">Redirecting...</span>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <div>
        <Button
          onClick={handleClone}
          disabled={cloneMutation.isPending}
          className="w-full min-h-12 bg-forge text-on-forge text-xs uppercase tracking-wider hover:brightness-110"
        >
          {cloneMutation.isPending ? (
            <>
              <Icon name="progress_activity" size={16} className="animate-spin" />
              Cloning...
            </>
          ) : (
            <>
              <Icon name="content_copy" size={16} />
              Clone to library
            </>
          )}
        </Button>
        {cloneMutation.isError && (
          <p className="text-xs text-warning-flare text-center mt-2">
            Failed to clone program. Check your connection and try again.
          </p>
        )}
      </div>
    )
  }

  // Unauthenticated
  return (
    <Button
      variant="secondary"
      onClick={handleSignIn}
      className="w-full min-h-12 text-xs uppercase tracking-wider"
    >
      <Icon name="login" size={16} />
      Sign in to clone
    </Button>
  )
}
