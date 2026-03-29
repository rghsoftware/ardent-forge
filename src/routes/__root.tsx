import { createRootRouteWithContext, Outlet, redirect } from '@tanstack/react-router'
import type { RouterContext } from '@/lib/auth'
import { getConfigStore } from '@/lib/config-store'

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    // Allow the /setup route itself to load without config
    if (location.pathname === '/setup') return

    const hasConfig = await getConfigStore().hasConfig()
    if (!hasConfig) {
      throw redirect({ to: '/setup' })
    }
  },
  component: () => <Outlet />,
})
