import { Link } from '@tanstack/react-router'
import { Icon } from '@/components/icon'
import { useAuth } from '@/lib/auth'
import { useUnreadCounts } from '@/hooks/use-chat'
import type { OnboardingRoute } from '@/domain/types'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { SKIP_DISCOVERY_ROUTES } from './nav-constants'

// Mobile nav omits Builder (requires wide viewport) and adds "Me" profile tab
const navItems = [
  { label: 'Forge', icon: 'hardware', to: '/' },
  { label: 'Tracker', icon: 'history', to: '/history' },
  { label: 'Library', icon: 'library_books', to: '/library' },
  { label: 'Vault', icon: 'monitoring', to: '/vault' },
  { label: 'Comms', icon: 'chat', to: '/comms' },
] as const

export function MobileNav() {
  const { user, isGuest } = useAuth()
  const initial = isGuest ? 'G' : (user?.email?.[0]?.toUpperCase() ?? '?')
  const { data: unreadMap } = useUnreadCounts()
  const totalUnread = unreadMap ? Array.from(unreadMap.values()).reduce((sum, n) => sum + n, 0) : 0
  const visitedRoutes = useOnboardingStore((s) => s.visitedRoutes)
  const hasVisited = (route: string) => visitedRoutes.includes(route as OnboardingRoute)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 heat-blur border-t border-ghost-line/15 pb-[var(--sai-bottom)]">
      <div className="flex items-stretch bg-surface-pit/80">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-1 flex-col items-center justify-center gap-1 min-h-[48px] py-2 text-warm-ash [&.active]:text-ember"
            activeProps={{ className: 'active' }}
            activeOptions={item.to === '/' ? { exact: true } : undefined}
          >
            {item.to === '/comms' ? (
              <span className="relative">
                <Icon name={item.icon} size={24} />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-ember rounded-full" />
                )}
              </span>
            ) : !SKIP_DISCOVERY_ROUTES.has(item.to) && !hasVisited(item.to) ? (
              <span className="relative">
                <Icon name={item.icon} size={24} />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-ember/60" />
              </span>
            ) : (
              <Icon name={item.icon} size={24} />
            )}
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
