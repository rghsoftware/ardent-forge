import { useCallback, useEffect, useRef, useState } from 'react'
import type { Conversation } from '@/domain/types'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

interface ConversationHeaderProps {
  conversation: Conversation
  displayName: string
  participantCount?: number
  onBack: () => void
  onBlock: () => void
  onLeave: () => void
  onViewParticipants: () => void
}

export function ConversationHeader({
  conversation,
  displayName,
  participantCount,
  onBack,
  onBlock,
  onLeave,
  onViewParticipants,
}: ConversationHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return

    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeMenu()
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen, closeMenu])

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu()
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [menuOpen, closeMenu])

  const isGroup = conversation.type === 'group'

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 bg-surface-anvil border-b border-ghost-line/15 px-4 py-3">
      <button
        type="button"
        aria-label="Go back"
        className="flex items-center justify-center text-bone-white hover:text-ember transition-colors"
        onClick={onBack}
      >
        <Icon name="arrow_back" size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="font-heading text-sm text-bone-white truncate">{displayName}</h1>
        {isGroup && participantCount != null && (
          <p className="text-xs text-warm-ash/60">({participantCount} members)</p>
        )}
      </div>

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-label="More options"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          className="flex items-center justify-center text-bone-white hover:text-ember transition-colors"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <Icon name="more_vert" size={20} />
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            className="absolute right-0 top-full mt-1 min-w-[160px] bg-surface-charcoal border border-ghost-line/15 py-1 shadow-lg"
          >
            {isGroup ? (
              <>
                <MenuButton
                  label="Participants"
                  onClick={() => {
                    onViewParticipants()
                    closeMenu()
                  }}
                />
                <MenuButton
                  label="Leave"
                  onClick={() => {
                    onLeave()
                    closeMenu()
                  }}
                />
                <MenuButton label="Archive" onClick={closeMenu} />
              </>
            ) : (
              <>
                <MenuButton
                  label="Block"
                  onClick={() => {
                    onBlock()
                    closeMenu()
                  }}
                />
                <MenuButton label="Archive" onClick={closeMenu} />
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

function MenuButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'w-full text-left px-4 py-2 text-sm text-bone-white hover:bg-surface-iron transition-colors',
        className,
      )}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
