import { cn } from '@/lib/utils'

interface IconProps {
  name: string
  size?: number
  fill?: boolean
  className?: string
}

export function Icon({ name, size = 24, fill = false, className }: IconProps) {
  if (import.meta.env.DEV && !name.match(/^[a-z][a-z0-9_]*$/)) {
    console.warn(
      `[Icon] Suspicious icon name: "${name}". Material Symbols names use lowercase_snake_case.`,
    )
  }

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
