import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { MobileNav } from '@/components/layout/mobile-nav'
import { SidebarNav } from '@/components/layout/sidebar-nav'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="flex h-dvh min-h-dvh bg-surface-anvil text-bone-white overflow-hidden">
      {/* Desktop sidebar -- hidden below lg */}
      <div className="hidden lg:flex">
        <SidebarNav />
      </div>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pb-safe">
        {/* On mobile, add bottom padding for the fixed nav */}
        <div className="pb-16 lg:pb-0 min-h-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav -- hidden at lg and above */}
      <div className="lg:hidden">
        <MobileNav />
      </div>

      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </div>
  )
}
