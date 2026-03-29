import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { SyncIndicator } from '@/components/layout/sync-indicator'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    if (!context.auth.loading && !context.auth.user && !context.auth.isGuest) {
      throw redirect({ to: '/sign-in' })
    }
  },
  component: AuthenticatedLayout,
})

interface NavItem {
  to: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'FORGE', icon: 'home' },
  { to: '/history', label: 'TRACKER', icon: 'history' },
  { to: '/exercises', label: 'LIBRARY', icon: 'fitness_center' },
  { to: '/profile', label: 'PROFILE', icon: 'person' },
]

function AuthenticatedLayout() {
  const { user, loading, isGuest } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // beforeLoad only fires on route transitions, not on runtime auth state
  // changes. This effect redirects when auth state changes while the user is
  // already on an authenticated route (e.g., session expiry, sign-out from
  // another tab).
  useEffect(() => {
    if (!loading && !user && !isGuest) {
      navigate({ to: '/sign-in' })
    }
  }, [loading, user, isGuest, navigate])
  const isWorkoutRoute = pathname.startsWith('/log/')

  return (
    <div className={`min-h-screen ${isWorkoutRoute ? '' : 'pb-16'}`}>
      <div className="fixed top-0 right-0 z-50">
        <SyncIndicator />
      </div>

      <Outlet />

      {/* Bottom navigation bar -- hidden during active workout */}
      {!isWorkoutRoute && (
        <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch border-t border-surface-steel bg-surface-pit">
          {NAV_ITEMS.map((item) => {
            const isActive = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)

            return (
              <Link
                key={item.to}
                to={item.to as '/'}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'text-ember' : 'text-warm-ash'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[24px]"
                  style={{
                    fontVariationSettings: isActive
                      ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                      : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                  }}
                >
                  {item.icon}
                </span>
                <span className="font-sans text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
