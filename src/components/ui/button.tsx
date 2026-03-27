import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-forge text-on-forge hover:bg-forge/90',
        molten: 'molten-gradient text-on-forge hover:opacity-90',
        secondary: 'bg-deep-slate text-on-deep-slate hover:bg-deep-slate/80',
        ghost: 'bg-transparent text-ember uppercase tracking-wider hover:bg-surface-steel/10',
        destructive: 'bg-alarm-red text-on-alarm hover:bg-alarm-red/90',
        outline:
          'border border-surface-steel bg-transparent text-on-surface hover:bg-surface-steel/10 rounded-none',
        link: 'text-ember underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        xs: 'h-7 px-2 text-xs',
        icon: 'h-10 w-10',
        'icon-xs': 'h-6 w-6',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
