import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const ForgeInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full border-b-2 border-surface-steel bg-transparent px-0 py-2 font-body text-base text-bone-white outline-none transition-colors placeholder:text-surface-steel focus:border-ember',
        className,
      )}
      {...props}
    />
  ),
)
ForgeInput.displayName = 'ForgeInput'

export const FORGE_LABEL_CLASS = 'font-sans text-xs font-medium text-warm-ash'
