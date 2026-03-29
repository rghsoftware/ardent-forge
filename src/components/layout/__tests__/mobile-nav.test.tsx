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

describe('MobileNav', () => {
  it('renders all four nav items', () => {
    render(<MobileNav />)
    expect(screen.getByText('FORGE')).toBeInTheDocument()
    expect(screen.getByText('TRACKER')).toBeInTheDocument()
    expect(screen.getByText('LIBRARY')).toBeInTheDocument()
    expect(screen.getByText('VAULT')).toBeInTheDocument()
  })

  it('renders correct nav icons', () => {
    render(<MobileNav />)
    expect(screen.getByTestId('icon-construction')).toBeInTheDocument()
    expect(screen.getByTestId('icon-timer')).toBeInTheDocument()
    expect(screen.getByTestId('icon-library_books')).toBeInTheDocument()
    expect(screen.getByTestId('icon-monitoring')).toBeInTheDocument()
  })

  it('renders correct links for each nav item', () => {
    render(<MobileNav />)
    expect(screen.getByTestId('nav-link-/')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-/tracker')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-/library')).toBeInTheDocument()
    expect(screen.getByTestId('nav-link-/vault')).toBeInTheDocument()
  })

  it('renders within a nav element', () => {
    render(<MobileNav />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders exactly 4 link elements', () => {
    render(<MobileNav />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(4)
  })
})
