import { createFileRoute } from '@tanstack/react-router'
import { GroupList } from '@/components/groups/group-list'

export const Route = createFileRoute('/_authenticated/groups')({
  component: GroupsPage,
})

function GroupsPage() {
  return <GroupList />
}
