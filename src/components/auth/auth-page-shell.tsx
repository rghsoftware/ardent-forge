import type { ReactNode } from 'react'

interface AuthPageShellProps {
  children: ReactNode
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-pit px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img
            src="/logos/fulllogo_transparent_nobuffer.png"
            alt="Ardent Forge"
            className="h-16 object-contain"
          />
        </div>
        {/* Panel with forge accent bar */}
        <div className="bg-surface-iron milled-edge overflow-hidden">
          <div className="h-0.5 bg-forge" />
          <div className="space-y-6 p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
