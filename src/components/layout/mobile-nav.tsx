import { Link } from '@tanstack/react-router'
import { Icon } from '@/components/icon'

const navItems = [
  { label: 'Forge', icon: 'hardware', to: '/' },
  { label: 'Tracker', icon: 'history', to: '/history' },
  { label: 'Library', icon: 'library_books', to: '/library' },
  { label: 'Vault', icon: 'monitoring', to: '/vault' },
  { label: 'Profile', icon: 'person', to: '/profile' },
] as const

export function MobileNav() {
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
      </div>
    </nav>
  )
}
