import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

/**
 * Creates a QueryClient configured for tests:
 * - Retries disabled to surface errors immediately
 * - GC time set to 0 so inactive query data is collected immediately, preventing data from leaking between tests
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * Test wrapper component for use with renderHook.
 * Creates a fresh QueryClient per mount.
 */
export function TestWrapper({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
}

/**
 * Renders a component wrapped with all necessary providers for testing.
 * Creates a fresh QueryClient per call unless one is provided.
 */
export function renderWithProviders(ui: ReactElement, options?: ProviderOptions) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options ?? {}

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}
