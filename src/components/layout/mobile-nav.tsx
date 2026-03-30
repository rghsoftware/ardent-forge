import { Link } from '@tanstack/react-router'
import { Icon } from '@/components/icon'
import { useAuth } from '@/lib/auth'

// Mobile nav omits Builder (requires desktop viewport) and adds "Me" profile tab
const navItems = [
  { label: 'Forge', icon: 'hardware', to: '/' },
  { label: 'Tracker', icon: 'history', to: '/history' },
  { label: 'Library', icon: 'library_books', to: '/library' },
  { label: 'Vault', icon: 'monitoring', to: '/vault' },
  { label: 'Social', icon: 'group', to: '/groups' },
] as const

export function MobileNav() {
  const { user, isGuest } = useAuth()
  const initial = isGuest ? 'G' : (user?.email?.[0]?.toUpperCase() ?? '?')

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 heat-blur border-t border-ghost-line/15">
      <div className="flex items-stretch bg-surface-pit/80">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-1 flex-col items-center justify-center gap-1 min-h-[48px] py-2 text-warm-ash [&.active]:text-ember"
            activeProps={{ className: 'active' }}
            activeOptions={item.to === '/' ? { exact: true } : undefined}
          >
            <Icon name={item.icon} size={24} />
            <span className="text-xs uppercase tracking-wider leading-none">{item.label}</span>
          </Link>
        ))}
        <Link
          to="/profile"
          className="flex flex-1 flex-col items-center justify-center gap-1 min-h-[48px] py-2 text-warm-ash [&.active]:text-ember"
          activeProps={{ className: 'active' }}
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-ember/20 text-ember text-xs font-semibold uppercase">
            {initial}
          </span>
          <span className="text-xs uppercase tracking-wider leading-none">Me</span>
        </Link>
      </div>
    </nav>
  )
}
