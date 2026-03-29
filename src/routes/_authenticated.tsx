import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { isTauri, invoke } from '@tauri-apps/api/core'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { SyncIndicator } from '@/components/layout/sync-indicator'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { MobileNav } from '@/components/layout/mobile-nav'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    if (!context.auth.loading && !context.auth.user && !context.auth.isGuest) {
      throw redirect({ to: '/sign-in', search: { reason: 'session-expired' } })
    }
  },
  component: AuthenticatedLayout,
})

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
      navigate({ to: '/sign-in', search: { reason: 'session-expired' } })
    }
  }, [loading, user, isGuest, navigate])

  // Start the session reminder background scheduler in Tauri mode.
  // The Rust scheduler polls every 60s and respects notification preferences.
  useEffect(() => {
    if (!isTauri()) return
    if (loading) return

    if (user || isGuest) {
      invoke('schedule_session_reminder').catch((err: unknown) => {
        console.warn('[session-reminder] Failed to start scheduler:', err)
      })
    }

    return () => {
      if (user || isGuest) {
        invoke('cancel_session_reminder').catch((err: unknown) => {
          console.warn('[session-reminder] Failed to stop scheduler:', err)
        })
      }
    }
  }, [user, isGuest, loading])

  const isWorkoutRoute = pathname.startsWith('/log/')

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <SidebarNav />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="absolute top-4 right-4 z-50">
          <SyncIndicator />
        </div>
        <main className={cn('flex-1 overflow-y-auto', !isWorkoutRoute && 'lg:pb-0 pb-16')}>
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        {!isWorkoutRoute && (
          <div className="lg:hidden">
            <MobileNav />
          </div>
        )}
      </div>
    </div>
  )
}
