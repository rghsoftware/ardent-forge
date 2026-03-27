import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { MobileNav } from '@/components/layout/mobile-nav'
import { SidebarNav } from '@/components/layout/sidebar-nav'

function RootErrorFallback({ error }: ErrorComponentProps) {
  return (
    <div className="flex items-center justify-center h-dvh bg-surface-anvil text-bone-white">
      <div className="flex flex-col items-center gap-6 px-6 text-center max-w-md">
        <div className="text-warning-flare text-5xl select-none">!</div>
        <h1 className="font-heading text-2xl font-bold tracking-wide uppercase">
          Something went wrong
        </h1>
        <p className="text-warm-ash text-sm">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-forge text-on-forge px-6 py-3 text-sm uppercase tracking-wider font-heading active:brightness-125"
        >
          Reload
        </button>
      </div>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="flex items-center justify-center h-dvh bg-surface-anvil text-bone-white">
      <div className="flex flex-col items-center gap-6 px-6 text-center max-w-md">
        <h1 className="font-heading text-4xl font-bold tracking-wide uppercase">404</h1>
        <p className="text-warm-ash text-sm">Page not found</p>
        <Link
          to="/"
          className="text-ember text-sm uppercase tracking-wider font-heading hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootErrorFallback,
  notFoundComponent: NotFoundPage,
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
