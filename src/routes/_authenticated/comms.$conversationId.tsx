import { createFileRoute } from '@tanstack/react-router'
import { ConversationDetail } from '@/components/chat/conversation-detail'

export const Route = createFileRoute('/_authenticated/comms/$conversationId')({
  component: ConversationDetailPage,
})

function ConversationDetailPage() {
  const { conversationId } = Route.useParams()
  return <ConversationDetail conversationId={conversationId} />
}
