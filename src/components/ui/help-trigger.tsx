import { useState } from 'react'
import type { ReactNode } from 'react'

import { Icon } from '@/components/icon'
import { useMediaQuery } from '@/hooks/use-media-query'

import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from './drawer'

interface HelpTriggerProps {
  title: string
  content: ReactNode
}

/**
 * Contextual help surface that adapts to the viewport.
 *
 * Renders a Popover on large screens (>=768px) and a Drawer on mobile (<768px).
 * The spec's `placement` prop was intentionally omitted -- responsive behavior
 * is automatic via the `useMediaQuery` hook, so callers never need to specify
 * where the help content appears.
 */
export function HelpTrigger({ title, content }: HelpTriggerProps) {
  const [open, setOpen] = useState(false)
  const isWideViewport = useMediaQuery('(min-width: 768px)')

  const triggerButton = (
    <button
      type="button"
      aria-label={`Help: ${title}`}
      className="inline-flex items-center justify-center text-warm-ash transition-colors hover:text-ember focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <Icon name="help_outline" size={20} />
    </button>
  )

  if (isWideViewport) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent className="max-w-[360px] bg-surface-gunmetal p-4">
          <div className="flex flex-col gap-2">
            <h3 className="font-heading text-sm font-medium text-bone-white">{title}</h3>
            <div className="font-body text-xs text-warm-ash">{content}</div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
      <DrawerContent className="bg-surface-gunmetal p-4 pb-6">
        <DrawerHeader className="p-0 pb-2">
          <DrawerTitle className="font-heading text-sm font-medium text-bone-white">
            {title}
          </DrawerTitle>
        </DrawerHeader>
        <div className="font-body text-xs text-warm-ash">{content}</div>
      </DrawerContent>
    </Drawer>
  )
}
