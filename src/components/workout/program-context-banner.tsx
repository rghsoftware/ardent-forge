interface ProgramContextBannerProps {
  programName?: string
  blockName?: string
  weekNumber?: number
  dayLabel?: string
}

export function ProgramContextBanner({
  programName,
  blockName,
  weekNumber,
  dayLabel,
}: ProgramContextBannerProps) {
  const segments: string[] = []

  if (blockName) segments.push(blockName)
  if (weekNumber != null && weekNumber > 0) segments.push(`Week ${weekNumber}`)
  if (dayLabel) segments.push(dayLabel)

  // Don't render if there is nothing to show
  if (!programName && segments.length === 0) return null

  return (
    <div className="bg-surface-iron px-4 py-2">
      <p className="text-xs text-warm-ash/60">
        {programName && <span className="text-ember">{programName}</span>}
        {programName && segments.length > 0 && (
          <span className="text-warm-ash/40">{' \u2014 '}</span>
        )}
        {segments.join(' \u2014 ')}
      </p>
    </div>
  )
}
