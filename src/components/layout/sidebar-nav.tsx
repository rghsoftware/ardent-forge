import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'DASHBOARD', icon: 'grid_view', to: '/' },
  { label: 'PROGRAM BUILDER', icon: 'precision_manufacturing', to: '/builder' },
  { label: 'ANALYTICS', icon: 'monitoring', to: '/vault' },
  { label: 'LIBRARY', icon: 'library_books', to: '/library' },
  { label: 'SETTINGS', icon: 'settings', to: '/settings' },
] as const

export function SidebarNav() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'flex flex-col bg-surface-pit h-full shrink-0 transition-none',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
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
    </aside>
  )
}
