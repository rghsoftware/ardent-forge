import { createFileRoute } from '@tanstack/react-router'
import { ConversationList } from '@/components/chat/conversation-list'

export const Route = createFileRoute('/_authenticated/comms')({
  component: CommsPage,
})

function CommsPage() {
  return <ConversationList />
}
