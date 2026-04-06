import { useState } from 'react'
import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isTauri } from '@tauri-apps/api/core'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>): { reason?: string; returnTo?: string } => ({
    reason: (search.reason as string) || undefined,
    returnTo: (search.returnTo as string) || undefined,
  }),
  beforeLoad: ({ context }) => {
    if (context.auth.user && !context.auth.isGuest) throw redirect({ to: '/' })
  },
  component: SignInPage,
})

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormValues = z.infer<typeof schema>

function SignInPage() {
  const auth = useAuth()
  const router = useRouter()
  const { reason, returnTo } = Route.useSearch()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })
  const [authError, setAuthError] = useState<string | null>(null)

  const onSubmit = async (values: FormValues) => {
    setAuthError(null)
    const { error } = await auth.signIn(values.email, values.password)
    if (error) {
      setAuthError(error.message)
    } else {
      router.navigate({ to: returnTo || '/' })
    }
  }

  return (
    <AuthPageShell>
      {reason === 'session-expired' && (
        <p className="bg-surface-gunmetal px-3 py-2 text-xs text-warm-ash">
          Your session expired. Please sign in again.
        </p>
      )}

      {reason === 'oauth_error' && (
        <p className="bg-surface-gunmetal px-3 py-2 text-xs text-warm-ash">
          Google sign-in failed. Please try again.
        </p>
      )}

      <h1 className="font-display text-xl font-medium text-bone-white">Sign in</h1>

      {/* Google sign-in */}
      <Button
        type="button"
        variant="outline"
        className="min-h-12 w-full border-surface-steel text-bone-white hover:bg-surface-gunmetal"
        onClick={async () => {
          setAuthError(null)
          const { error } = await auth.signInWithGoogle()
          if (error) setAuthError(error.message)
        }}
      >
        Continue with Google
      </Button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-surface-steel" />
        <span className="text-xs text-warm-ash/50">or</span>
        <div className="flex-1 border-t border-surface-steel" />
      </div>

      {/* Email / password form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1">
          <label htmlFor="email" className={FORGE_LABEL_CLASS}>
            Email
          </label>
          <ForgeInput id="email" type="email" {...register('email')} />
          {errors.email && <p className="text-xs text-warning-flare">{errors.email.message}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className={FORGE_LABEL_CLASS}>
            Password
          </label>
          <ForgeInput id="password" type="password" {...register('password')} />
          {errors.password && (
            <p className="text-xs text-warning-flare">{errors.password.message}</p>
          )}
        </div>

        {authError && <p className="text-xs text-warning-flare">{authError}</p>}

        <Button type="submit" className="min-h-12 w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      {/* Navigation links */}
      <div className="space-y-2 text-center text-sm">
        <Link
          to="/forgot-password"
          className="block text-warm-ash transition-colors hover:text-ember"
        >
          Forgot password?
        </Link>
        <p className="text-warm-ash">
          Don&apos;t have an account?{' '}
          <Link to="/sign-up" className="text-ember hover:text-ember/80">
            Sign up
          </Link>
        </p>
      </div>

      {/* Guest mode -- Tauri only */}
      {isTauri() && (
        <>
          <div className="border-t border-surface-steel" />
          <Button
            variant="ghost"
            className="min-h-12 w-full text-warm-ash/60 hover:text-warm-ash"
            onClick={() => {
              if (auth.continueAsGuest()) {
                router.navigate({ to: '/' })
              }
            }}
          >
            Continue as Guest
          </Button>
          <p className="text-center text-xs text-warm-ash/40">
            Your data stays on this device only.
          </p>
        </>
      )}
    </AuthPageShell>
  )
}
