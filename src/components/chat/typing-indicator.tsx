import { cn } from '@/lib/utils'

interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; userName: string }>
}

function formatTypingText(users: TypingIndicatorProps['typingUsers']): string {
  if (users.length === 0) return ''
  if (users.length === 1) return `${users[0].userName} is typing`
  if (users.length === 2) return `${users[0].userName} and ${users[1].userName} are typing`
  return `${users.length} people are typing`
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null

  return (
    <div
      className={cn(
        'flex h-6 items-center gap-1.5 px-4 text-xs text-warm-ash/60',
        'animate-in fade-in slide-in-from-bottom-1 duration-200',
      )}
    >
      <span className="flex items-center gap-0.5">
        <span className="inline-block h-1.5 w-1.5 bg-warm-ash/60 animate-[typing-dot_1.4s_ease-in-out_infinite]" />
        <span className="inline-block h-1.5 w-1.5 bg-warm-ash/60 animate-[typing-dot_1.4s_ease-in-out_0.2s_infinite]" />
        <span className="inline-block h-1.5 w-1.5 bg-warm-ash/60 animate-[typing-dot_1.4s_ease-in-out_0.4s_infinite]" />
      </span>
      <span>{formatTypingText(typingUsers)}</span>

      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
