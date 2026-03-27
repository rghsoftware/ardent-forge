import { createFileRoute, Link, Outlet, redirect, useRouterState } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    if (!context.auth.loading && !context.auth.user) {
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
  { to: '/exercises', label: 'LIBRARY', icon: 'fitness_center' },
  { to: '/profile', label: 'PROFILE', icon: 'person' },
]

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="min-h-screen pb-16">
      <Outlet />

      {/* Bottom navigation bar */}
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
    </div>
  )
}
