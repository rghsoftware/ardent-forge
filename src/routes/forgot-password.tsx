import { useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: ({ context }) => {
    if (context.auth.user && !context.auth.isGuest) throw redirect({ to: '/' })
  },
  component: ForgotPasswordPage,
})

const schema = z.object({
  email: z.string().email('Invalid email address'),
})

type FormValues = z.infer<typeof schema>

function ForgotPasswordPage() {
  const auth = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })
  const [authError, setAuthError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const onSubmit = async (values: FormValues) => {
    setAuthError(null)
    const { error } = await auth.resetPassword(values.email)
    if (error) {
      setAuthError(error.message)
    } else {
      setSuccess(true)
    }
  }

  return (
    <AuthPageShell>
      <div className="space-y-0.5">
        <h1 className="font-display text-xl font-medium text-bone-white">Reset password</h1>
        <p className="text-sm text-warm-ash">Enter your email to receive a reset link</p>
      </div>

      {success ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-warm-ash">Check your email for a password reset link.</p>
          <Link
            to="/sign-in"
            search={{ reason: undefined }}
            className="text-sm text-ember hover:text-ember/80"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1">
              <label htmlFor="email" className={FORGE_LABEL_CLASS}>
                Email
              </label>
              <ForgeInput id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-warning-flare">{errors.email.message}</p>}
            </div>

            {authError && <p className="text-xs text-warning-flare">{authError}</p>}

            <Button type="submit" className="min-h-12 w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>

          <p className="text-center text-sm">
            <Link
              to="/sign-in"
              search={{ reason: undefined }}
              className="text-warm-ash transition-colors hover:text-ember"
            >
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthPageShell>
  )
}
