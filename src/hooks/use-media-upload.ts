import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import { validateFile } from '@/lib/media-constraints'
import { MediaUploadService } from '@/lib/media-upload-service'
import type { MediaType } from '@/domain/types'

// ---------------------------------------------------------------------------
// useMediaUpload -- orchestrates file validation, upload, and persistence
// ---------------------------------------------------------------------------

export interface UseMediaUploadReturn {
  upload: (file: File, type: MediaType) => Promise<void>
  progress: number
  isUploading: boolean
  error: string | null
  cancel: () => void
  retry: () => void
}

const VIDEO_TRANSCODING_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export function useMediaUpload(conversationId: string): UseMediaUploadReturn {
  const queryClient = useQueryClient()

  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serviceRef = useRef<MediaUploadService | null>(null)
  const lastAttemptRef = useRef<{ file: File; type: MediaType } | null>(null)
  const transcodingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear transcoding timeout on unmount
  useEffect(() => {
    return () => {
      if (transcodingTimerRef.current) {
        clearTimeout(transcodingTimerRef.current)
        transcodingTimerRef.current = null
      }
    }
  }, [])

  const upload = useCallback(
    async (file: File, type: MediaType) => {
      lastAttemptRef.current = { file, type }
      setError(null)
      setProgress(0)

      // 1. Validate
      const validation = await validateFile(file, type)
      if (!validation.valid) {
        setError(validation.error)
        return
      }

      // 2. Connectivity check
      if (!navigator.onLine) {
        setError('Media uploads require an internet connection')
        return
      }

      // 3. Upload
      setIsUploading(true)
      const service = new MediaUploadService(conversationId)
      serviceRef.current = service

      try {
        let result
        if (type === 'video') {
          result = await service.uploadVideo(file, setProgress)
        } else if (type === 'image') {
          result = await service.uploadImage(file, setProgress)
        } else {
          result = await service.uploadFile(file, setProgress)
        }

        // 4. Persist: create message then attach media metadata
        const adapter = getAdapter()
        const message = await adapter.sendMessage(conversationId, 'media')
        await adapter.saveMediaAttachment(message.id, {
          messageId: message.id,
          provider: result.provider,
          providerAssetId: result.providerAssetId,
          mediaType: result.mediaType,
          status: result.status,
          originalFilename: result.originalFilename,
          mimeType: result.mimeType,
          fileSizeBytes: result.fileSizeBytes,
        })

        // 5. Invalidate messages query so UI refreshes
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })

        // 6. For video: mark as failed if transcoding stalls past 5 min
        if (type === 'video' && message.id) {
          transcodingTimerRef.current = setTimeout(async () => {
            try {
              const adapter = getAdapter()
              const currentAttachments = await adapter.getMediaAttachments([message.id])
              const att = currentAttachments.find(
                (a) => a.providerAssetId === result.providerAssetId,
              )
              if (att && att.status === 'processing') {
                await adapter.updateMediaAttachment(att.id, { status: 'failed' })
                queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
                queryClient.invalidateQueries({ queryKey: ['media-attachments'] })
                console.warn(
                  `[media-upload] Video ${result.providerAssetId} transcoding timed out -- marked as failed`,
                )
              }
            } catch (err) {
              console.error('[media-upload] Failed to update timed-out transcoding status:', err)
            }
          }, VIDEO_TRANSCODING_TIMEOUT_MS)
        }

        setProgress(1)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        setError(msg)
        console.error('[media-upload] Upload failed:', err)
      } finally {
        setIsUploading(false)
        serviceRef.current = null
      }
    },
    [conversationId, queryClient],
  )

  const cancel = useCallback(() => {
    serviceRef.current?.cancelUpload()
    setIsUploading(false)
    setProgress(0)
  }, [])

  const retry = useCallback(() => {
    if (lastAttemptRef.current) {
      void upload(lastAttemptRef.current.file, lastAttemptRef.current.type)
    }
  }, [upload])

  return { upload, progress, isUploading, error, cancel, retry }
}
