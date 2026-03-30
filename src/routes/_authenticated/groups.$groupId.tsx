import { createFileRoute } from '@tanstack/react-router'
import { GroupDetail } from '@/components/groups/group-detail'

export const Route = createFileRoute('/_authenticated/groups/$groupId')({
  component: GroupDetailPage,
})

function GroupDetailPage() {
  const { groupId } = Route.useParams()
  return <GroupDetail groupId={groupId} />
}
