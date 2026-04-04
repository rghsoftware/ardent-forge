import { useState, useEffect, useRef } from 'react'

interface ClockDisplayProps {
  format: '12h' | '24h'
  serverTimeCorrection?: string
}

export function ClockDisplay({ format, serverTimeCorrection }: ClockDisplayProps) {
  const [now, setNow] = useState(() => new Date())
  const offsetRef = useRef(0)

  // When server time arrives, compute offset for drift correction (Tech.md D5)
  useEffect(() => {
    if (serverTimeCorrection) {
      const serverTime = new Date(serverTimeCorrection).getTime()
      if (!Number.isNaN(serverTime)) {
        offsetRef.current = serverTime - Date.now()
        setNow(new Date(Date.now() + offsetRef.current))
      }
    }
  }, [serverTimeCorrection])

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date(Date.now() + offsetRef.current))
    }, 1000)

    return () => clearInterval(id)
  }, [serverTimeCorrection])

  const timeString =
    format === '24h'
      ? now.toLocaleTimeString('en-GB')
      : now.toLocaleTimeString('en-US', { hour12: true })

  return (
    <span className="font-display text-[8rem] leading-none text-foreground tracking-tight">
      {timeString}
    </span>
  )
}
