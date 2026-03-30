import { createFileRoute } from '@tanstack/react-router'
import { ConnectionList } from '@/components/connections/connection-list'

export const Route = createFileRoute('/_authenticated/connections')({
  component: ConnectionsPage,
})

function ConnectionsPage() {
  return <ConnectionList />
}
