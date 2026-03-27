import { cn } from '@/lib/utils'

interface IconProps {
  name: string
  size?: number
  fill?: boolean
  className?: string
}

export function Icon({ name, size = 24, fill = false, className }: IconProps) {
  return (
    <span
      className={cn('material-symbols-outlined', className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        lineHeight: 1,
        display: 'inline-block',
        userSelect: 'none',
      }}
    >
      {name}
    </span>
  )
}
