import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { AuthProvider, useAuth, type RouterContext } from '@/lib/auth'
import { queryClient } from '@/lib/query-client'
import { SyncListener } from '@/components/sync-listener'
import { ChatRealtimeListener } from '@/components/chat-realtime-listener'
import { resolveConfig } from '@/lib/config-store'
import { initSupabaseFromConfig } from '@/lib/supabase'
import { Toaster } from 'sonner'
import './index.css'

const router = createRouter({
  routeTree,
  context: {
    auth: { user: null, session: null, loading: true, isGuest: false },
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

;(async () => {
  const config = await resolveConfig()
  if (config) {
    initSupabaseFromConfig(config)
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <SyncListener />
        <AuthProvider>
          <ChatRealtimeListener />
          <InnerApp />
        </AuthProvider>
        <Toaster
          position="bottom-center"
          toastOptions={{
            className: 'bg-surface-iron text-bone-white border-surface-steel',
          }}
        />
      </QueryClientProvider>
    </React.StrictMode>,
  )
})().catch((err) => {
  console.error('[startup] Fatal error during initialization:', err)
  const root = document.getElementById('root')
  if (root) {
    const container = document.createElement('div')
    container.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#999'
    const title = document.createElement('p')
    title.textContent = 'Failed to start Ardent Forge'
    const detail = document.createElement('p')
    detail.style.cssText = 'font-size:0.875rem;margin-top:0.5rem'
    detail.textContent = err instanceof Error ? err.message : 'Unknown error'
    const retry = document.createElement('button')
    retry.style.cssText = 'margin-top:1rem;padding:0.5rem 1rem;cursor:pointer'
    retry.textContent = 'Retry'
    retry.addEventListener('click', () => location.reload())
    container.append(title, detail, retry)
    root.appendChild(container)
  }
})
