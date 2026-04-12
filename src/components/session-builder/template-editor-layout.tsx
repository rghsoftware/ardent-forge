import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Icon } from '@/components/icon'

interface TemplateEditorLayoutProps {
  title: string
  children: ReactNode
  onBack?: () => void
}

/**
 * Full-page shell for the template editor routes. Purely presentational:
 * provides the full-width wrapper, header with back link + title, and hosts
 * the form body as children. Save/cancel remain inside the form itself
 * (ADR-021-02).
 *
 * Intentionally omits `max-w-5xl`: the session-template form's 3-column grid
 * (xl:grid-cols-[280px_1fr_260px]) and the xl/2xl picker drawer docking both
 * require unrestricted viewport width. Content density is managed by the
 * form's own column widths, not a page-level cap.
 */
export function TemplateEditorLayout({ title, children, onBack }: TemplateEditorLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="px-4 md:px-6 lg:px-8">
        <header className="flex items-center gap-3 py-4 md:py-6">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex min-h-12 items-center gap-1 bg-transparent px-2 text-xs text-warm-ash/60 hover:text-bone-white"
              aria-label="Back to library"
            >
              <Icon name="arrow_back" size={18} />
              <span>Library</span>
            </button>
          ) : (
            <Link
              to="/library"
              search={{ tab: 'templates' }}
              className="flex min-h-12 items-center gap-1 px-2 text-xs text-warm-ash/60 hover:text-bone-white"
              aria-label="Back to library"
            >
              <Icon name="arrow_back" size={18} />
              <span>Library</span>
            </Link>
          )}
          <h1 className="font-display text-xl text-bone-white md:text-2xl">{title}</h1>
        </header>

        <div className="pb-8">{children}</div>
      </div>
    </div>
  )
}
