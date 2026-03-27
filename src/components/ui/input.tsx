import * as React from 'react'

import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          // Base: underline-only, no boxed borders
          'w-full bg-surface-gunmetal text-bone-white',
          'px-3 py-2',
          'rounded-none',
          'border-0 border-b-2 border-transparent',
          'outline-none',
          'placeholder:text-warm-ash/50',
          // Focus: ember underline
          'focus:border-b-ember',
          // Filled state handled by text color
          'data-[filled=true]:border-b-ghost-line',
          // Error state
          error && 'text-warning-flare bg-surface-steel border-b-warning-flare',
          // Disabled
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
