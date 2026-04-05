import { useState, useId, useRef, useEffect, type ReactNode } from 'react'
import { Icon } from '@/components/icon'

interface CollapsedFieldsRowProps {
  labels: [string, ...string[]]
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
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    if (expanded) {
      el.style.maxHeight = `${el.scrollHeight}px`
    } else {
      el.style.maxHeight = '0px'
    }
  }, [expanded])

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
      <div
        ref={contentRef}
        id={contentId}
        className="overflow-hidden transition-[max-height] duration-200 ease-out"
        style={{ maxHeight: defaultExpanded ? undefined : '0px' }}
      >
        {children}
      </div>
    </div>
  )
}
