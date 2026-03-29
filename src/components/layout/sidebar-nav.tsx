import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

const navItems = [
  { label: 'Forge', icon: 'hardware', to: '/' },
  { label: 'Tracker', icon: 'history', to: '/history' },
  { label: 'Builder', icon: 'construction', to: '/builder' },
  { label: 'Vault', icon: 'monitoring', to: '/vault' },
  { label: 'Library', icon: 'library_books', to: '/library' },
] as const

function getInitials(
  user: { email?: string | null; user_metadata?: Record<string, unknown> } | null,
  isGuest: boolean,
): string {
  if (isGuest) return 'G'
  const name = user?.user_metadata?.full_name
  if (typeof name === 'string' && name.trim()) {
    const words = name.trim().split(/\s+/)
    return words.length === 1
      ? words[0][0].toUpperCase()
      : (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }
  return user?.email?.[0]?.toUpperCase() ?? '?'
}

export function SidebarNav() {
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { user, isGuest, signOut } = useAuth()

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const initials = getInitials(user, isGuest)
  const displayName = isGuest
    ? 'Guest'
    : ((user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? '')

  return (
    <aside
      className={cn(
        'flex flex-col bg-surface-pit h-full shrink-0 transition-none',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center px-3 pt-4 pb-2',
          collapsed ? 'justify-center' : 'justify-start',
        )}
      >
        {collapsed ? (
          <img
            src="/logos/icononly_transparent_nobuffer.png"
            alt="Ardent Forge"
            className="h-8 w-8 object-contain"
          />
        ) : (
          <img
            src="/logos/fulllogo_transparent_nobuffer.png"
            alt="Ardent Forge"
            className="h-10 object-contain"
          />
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-14 text-warm-ash hover:text-ember active:brightness-125 w-full"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size={20} />
      </button>

      {/* Nav items */}
      <nav className="flex flex-col flex-1 py-2">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-4 py-3 min-h-[48px] text-warm-ash [&.active]:text-ember hover:bg-surface-iron"
            activeProps={{ className: 'active' }}
            activeOptions={item.to === '/' ? { exact: true } : undefined}
          >
            <Icon name={item.icon} size={20} className="shrink-0" />
            {!collapsed && (
              <span className="text-xs uppercase tracking-wider truncate">{item.label}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* Avatar / account menu */}
      <div ref={menuRef} className="relative border-t border-ghost-line/15">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={cn(
            'flex items-center gap-3 w-full px-4 py-3 min-h-[48px] text-warm-ash hover:bg-surface-iron',
            collapsed && 'justify-center',
          )}
          aria-label="Account menu"
          aria-expanded={menuOpen}
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-ember/20 text-ember text-xs font-semibold uppercase shrink-0">
            {initials}
          </span>
          {!collapsed && <span className="text-xs truncate flex-1 text-left">{displayName}</span>}
        </button>

        {menuOpen && (
          <div
            className={cn(
              'absolute bottom-full left-0 mb-1 bg-surface-iron border border-ghost-line/20 shadow-lg z-50 py-1',
              collapsed ? 'w-48' : 'w-full',
            )}
          >
            <Link
              to="/profile"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2 min-h-[40px] text-xs uppercase tracking-wider text-warm-ash hover:bg-surface-pit hover:text-ember"
            >
              <Icon name="person" size={16} className="shrink-0" />
              Profile
            </Link>
            <div className="border-t border-ghost-line/15 my-1" />
            <button
              onClick={async () => {
                setMenuOpen(false)
                await signOut()
              }}
              className="flex w-full items-center gap-3 px-4 py-2 min-h-[40px] text-xs uppercase tracking-wider text-warm-ash hover:bg-surface-pit hover:text-ember"
            >
              <Icon name="logout" size={16} className="shrink-0" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
