import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { GroupList } from '@/components/groups/group-list'
import { useOnboarding } from '@/hooks/use-onboarding'

export const Route = createFileRoute('/_authenticated/groups')({
  component: GroupsPage,
})

function GroupsPage() {
  const { markRouteVisited } = useOnboarding()

  useEffect(() => {
    markRouteVisited('/groups')
  }, [markRouteVisited])

  return <GroupList />
}
