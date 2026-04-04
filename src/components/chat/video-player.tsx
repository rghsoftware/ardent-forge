import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/icon'

// ---------------------------------------------------------------------------
// VideoPlayer -- HLS video overlay with play/pause, scrubber, fullscreen
// ---------------------------------------------------------------------------

interface VideoPlayerProps {
  signedUrl: string
  onClose: () => void
}

export function VideoPlayer({ signedUrl, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<{ destroy: () => void } | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)

  // Initialize HLS playback
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let destroyed = false

    async function initHls() {
      try {
        const { default: Hls } = await import('hls.js')

        if (destroyed) return

        if (Hls.isSupported()) {
          const hls = new Hls()
          hlsRef.current = hls
          hls.loadSource(signedUrl)
          hls.attachMedia(video!)
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setError(true)
          })
        } else if (video!.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS
          video!.src = signedUrl
          video!.addEventListener('error', () => setError(true))
        } else {
          setError(true)
        }
      } catch (err) {
        console.warn('[video-player] hls.js import failed, falling back to native:', err)
        // hls.js not available, try native
        if (!destroyed && video) {
          video.src = signedUrl
          video.addEventListener('error', () => setError(true))
        } else {
          setError(true)
        }
      }
    }

    initHls()

    return () => {
      destroyed = true
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [signedUrl])

  // Track progress
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTimeUpdate = () => setProgress(video.currentTime)
    const onDurationChange = () => setDuration(video.duration || 0)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }, [])

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const time = Number(e.target.value)
    video.currentTime = time
    setProgress(time)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen()
    }
  }, [])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-pit/90"
      onClick={handleBackdropClick}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-bone-white hover:text-warm-ash transition-colors z-10"
        aria-label="Close video player"
      >
        <Icon name="close" size={28} />
      </button>

      <div className="relative flex w-full max-w-3xl flex-col">
        {error ? (
          <div className="aspect-video flex items-center justify-center bg-surface-charcoal">
            <span className="text-warm-ash text-sm">Failed to load video</span>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black"
            playsInline
            onClick={togglePlay}
          />
        )}

        <div className="flex items-center gap-3 bg-surface-charcoal px-3 py-2">
          <button
            type="button"
            onClick={togglePlay}
            className="text-bone-white shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <Icon name={isPlaying ? 'pause' : 'play_arrow'} size={24} />
          </button>

          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={progress}
            onChange={handleScrub}
            className="flex-1 h-1 appearance-none bg-surface-steel [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:bg-ember"
          />

          <button
            type="button"
            onClick={toggleFullscreen}
            className="text-bone-white shrink-0"
            aria-label="Toggle fullscreen"
          >
            <Icon name="fullscreen" size={24} />
          </button>
        </div>
      </div>
    </div>
  )
}
