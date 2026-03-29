import { createRootRouteWithContext, Outlet, redirect } from '@tanstack/react-router'
import type { RouterContext } from '@/lib/auth'
import { getConfigStore } from '@/lib/config-store'

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    // Allow /setup to load without a backend configuration (it's where the user provides one)
    if (location.pathname === '/setup') return

    let hasConfig = false
    try {
      hasConfig = await getConfigStore().hasConfig()
    } catch (err) {
      console.error('[root] Failed to check config, redirecting to setup:', err)
    }
    if (!hasConfig) {
      throw redirect({ to: '/setup' })
    }
  },
  component: () => <Outlet />,
})
