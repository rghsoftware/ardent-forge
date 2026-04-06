import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ConnectionList } from '@/components/connections/connection-list'
import { useOnboarding } from '@/hooks/use-onboarding'

export const Route = createFileRoute('/_authenticated/connections')({
  component: ConnectionsPage,
})

function ConnectionsPage() {
  const { markRouteVisited } = useOnboarding()

  useEffect(() => {
    markRouteVisited('/connections')
  }, [markRouteVisited])

  return <ConnectionList />
}
