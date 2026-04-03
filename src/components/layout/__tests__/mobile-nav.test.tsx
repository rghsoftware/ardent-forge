// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { MobileNav } from '@/components/layout/mobile-nav'

// Mock TanStack Router Link to render as simple anchors
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode
    to: string
    className?: string
    activeProps?: { className: string }
  }) => (
    <a href={to} className={className} data-testid={`nav-link-${to}`}>
      {children}
    </a>
  ),
}))

// Mock Icon to avoid Material Symbols font dependency
vi.mock('@/components/icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}))

// Mock useAuth to avoid Supabase dependency
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@example.com' }, isGuest: false }),
}))

// Mock useUnreadCounts to avoid QueryClient dependency
vi.mock('@/hooks/use-chat', () => ({
  useUnreadCounts: () => ({ data: undefined }),
}))

describe('MobileNav', () => {
  it('renders all five nav items plus profile', () => {
    render(<MobileNav />)
    expect(screen.getByText('Forge')).toBeInTheDocument()
    expect(screen.getByText('Tracker')).toBeInTheDocument()
    expect(screen.getByText('Library')).toBeInTheDocument()
    expect(screen.getByText('Vault')).toBeInTheDocument()
    expect(screen.getByText('Comms')).toBeInTheDocument()
    expect(screen.getByText('Me')).toBeInTheDocument()
  })

  it('renders correct nav icons', () => {
    render(<MobileNav />)
    expect(screen.getByTestId('icon-hardware')).toBeInTheDocument()
    expect(screen.getByTestId('icon-history')).toBeInTheDocument()
    expect(screen.getByTestId('icon-library_books')).toBeInTheDocument()
    expect(screen.getByTestId('icon-monitoring')).toBeInTheDocument()
    expect(screen.getByTestId('icon-chat')).toBeInTheDocument()
  })

  it('renders correct links for each nav item', () => {
    render(<MobileNav />)
    expect(screen.getByTestId('nav-link-/')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-/history')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-/library')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-/vault')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-/comms')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-/profile')).toBeInTheDocument()
  })

  it('renders within a nav element', () => {
    render(<MobileNav />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders exactly 6 link elements', () => {
    render(<MobileNav />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(6)
  })
})
