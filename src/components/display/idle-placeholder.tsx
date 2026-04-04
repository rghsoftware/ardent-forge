import { useEffect, useState } from 'react'

function IdlePlaceholder() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <p className="font-display text-[8rem] leading-none text-bone-white">{time}</p>
      <p className="mt-4 font-sans text-xl text-warm-ash">{date}</p>
      <p className="mt-6 text-sm tracking-wider text-oxidized-edge">NO ACTIVE SESSIONS</p>
    </div>
  )
}

export { IdlePlaceholder }
