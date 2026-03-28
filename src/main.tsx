import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { AuthProvider, useAuth, type RouterContext } from '@/lib/auth'
import { queryClient } from '@/lib/query-client'
import { SyncListener } from '@/components/sync-listener'
import './index.css'

const router = createRouter({
  routeTree,
  context: {
    auth: { user: null, session: null, loading: true },
  } satisfies RouterContext,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// eslint-disable-next-line react-refresh/only-export-components
function InnerApp() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SyncListener />
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
