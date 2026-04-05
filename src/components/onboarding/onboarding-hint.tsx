import { type ReactNode } from 'react'
import { useOnboarding } from '@/hooks/use-onboarding'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

interface OnboardingHintProps {
  hintKey: string
  children: ReactNode
  position?: 'above' | 'below'
  className?: string
}

export function OnboardingHint({
  hintKey,
  children,
  position = 'above',
  className,
}: OnboardingHintProps) {
  const { shouldShowHint, markHintSeen } = useOnboarding()

  if (!shouldShowHint(hintKey)) return null

  return (
    <div
      className={cn(
        'relative border-l-2 border-ember bg-surface-gunmetal px-4 py-3',
        'motion-safe:animate-[hint-fade-in_300ms_ease-out]',
        position === 'below' ? 'mt-3' : 'mb-3',
        className,
      )}
      role="status"
      data-testid={`onboarding-hint-${hintKey}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 text-xs text-warm-ash leading-relaxed">{children}</div>
        <button
          type="button"
          onClick={() => markHintSeen(hintKey)}
          className="flex min-h-12 min-w-12 shrink-0 items-center justify-center text-warm-ash/60 hover:text-bone-white"
          aria-label="Dismiss hint"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
    </div>
  )
}
