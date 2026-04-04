import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { MediaAttachment } from '@/domain/types'

// ---------------------------------------------------------------------------
// useMediaAttachments -- fetches and caches media attachments by message IDs
// ---------------------------------------------------------------------------

function buildQueryKey(messageIds: string[]): readonly [string, ...string[]] {
  const sorted = [...messageIds].sort()
  return ['media-attachments', ...sorted]
}

export function useMediaAttachments(messageIds: string[]) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: buildQueryKey(messageIds),
    queryFn: async (): Promise<Map<string, MediaAttachment>> => {
      if (messageIds.length === 0) return new Map()
      const attachments = await getAdapter().getMediaAttachments(messageIds)
      const map = new Map<string, MediaAttachment>()
      for (const attachment of attachments) {
        map.set(attachment.messageId, attachment)
      }
      return map
    },
    enabled: messageIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const updateAttachment = useCallback(
    (
      attachmentId: string,
      updates: Partial<
        Pick<MediaAttachment, 'status' | 'thumbnailUrl' | 'playbackUrl' | 'providerAssetId'>
      >,
    ) => {
      queryClient.setQueryData<Map<string, MediaAttachment>>(buildQueryKey(messageIds), (old) => {
        if (!old) return old
        const next = new Map(old)
        for (const [msgId, attachment] of next) {
          if (attachment.id === attachmentId) {
            next.set(msgId, { ...attachment, ...updates })
            break
          }
        }
        return next
      })
    },
    [queryClient, messageIds],
  )

  return {
    attachments: query.data ?? new Map<string, MediaAttachment>(),
    isLoading: query.isLoading,
    error: query.error,
    updateAttachment,
  }
}
