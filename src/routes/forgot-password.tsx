import { useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: ({ context }) => {
    if (context.auth.user) throw redirect({ to: '/' })
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

        {/* Form panel */}
        <div className="bg-surface-iron milled-edge overflow-hidden">
          <div className="h-0.5 bg-forge" />
          <div className="space-y-6 p-6">
            <div className="space-y-0.5">
              <h1 className="font-display text-xl font-bold text-bone-white">Reset password</h1>
              <p className="text-sm text-warm-ash">Enter your email to receive a reset link</p>
            </div>

            {success ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-warm-ash">Check your email for a password reset link.</p>
                <Link to="/sign-in" className="text-sm text-ember hover:text-ember/80">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="space-y-1">
                    <label htmlFor="email" className="font-sans text-xs font-medium text-warm-ash">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="w-full border-b-2 border-surface-steel bg-transparent px-0 py-2 font-body text-base text-bone-white outline-none transition-colors placeholder:text-surface-steel focus:border-ember"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="text-xs text-warning-flare">{errors.email.message}</p>
                    )}
                  </div>

                  {authError && <p className="text-xs text-warning-flare">{authError}</p>}

                  <Button type="submit" className="min-h-12 w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Send reset link'}
                  </Button>
                </form>

                <p className="text-center text-sm">
                  <Link to="/sign-in" className="text-warm-ash transition-colors hover:text-ember">
                    Back to sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
