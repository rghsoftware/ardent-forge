import { useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'

export const Route = createFileRoute('/sign-up')({
  beforeLoad: ({ context }) => {
    if (context.auth.user && !context.auth.isGuest) throw redirect({ to: '/' })
  },
  component: SignUpPage,
})

const schema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

function SignUpPage() {
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
    const { error } = await auth.signUp(values.email, values.password)
    if (error) {
      setAuthError(error.message)
    } else {
      setSuccess(true)
    }
  }

  return (
    <AuthPageShell>
      <div className="space-y-0.5">
        <h1 className="font-display text-xl font-bold text-bone-white">Create account</h1>
        <p className="text-sm text-warm-ash">Sign up for Ardent Forge</p>
      </div>

      {success ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-warm-ash">Check your email to confirm your account.</p>
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

            <div className="space-y-1">
              <label htmlFor="password" className={FORGE_LABEL_CLASS}>
                Password
              </label>
              <ForgeInput id="password" type="password" {...register('password')} />
              {errors.password && (
                <p className="text-xs text-warning-flare">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className={FORGE_LABEL_CLASS}>
                Confirm password
              </label>
              <ForgeInput id="confirmPassword" type="password" {...register('confirmPassword')} />
              {errors.confirmPassword && (
                <p className="text-xs text-warning-flare">{errors.confirmPassword.message}</p>
              )}
            </div>

            {authError && <p className="text-xs text-warning-flare">{authError}</p>}

            <Button type="submit" className="min-h-12 w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-sm text-warm-ash">
            Already have an account?{' '}
            <Link
              to="/sign-in"
              search={{ reason: undefined }}
              className="text-ember hover:text-ember/80"
            >
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthPageShell>
  )
}
