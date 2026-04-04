import { useState, useId, type ReactNode } from 'react'
import { Icon } from '@/components/icon'

interface CollapsedFieldsRowProps {
  labels: string[]
  children: ReactNode
  defaultExpanded?: boolean
}

export function CollapsedFieldsRow({
  labels,
  children,
  defaultExpanded = false,
}: CollapsedFieldsRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const contentId = useId()

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between bg-surface-charcoal px-3 py-2"
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <span className="font-body text-xs uppercase tracking-wider text-warm-ash">
          {labels.join(', ')}
        </span>
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size={20} />
      </button>
      {expanded && <div id={contentId}>{children}</div>}
    </div>
  )
}
