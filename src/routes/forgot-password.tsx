import { useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <img
            src="/logos/fulllogo_transparent_nobuffer.png"
            alt="Ardent Forge"
            className="h-16 object-contain"
          />
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>Enter your email to receive a reset link</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {success ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Check your email for a password reset link.
                </p>
                <Link
                  to="/sign-in"
                  className="inline-block text-sm text-foreground hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register('email')} />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                  {authError && <p className="text-sm text-destructive">{authError}</p>}
                  <Button type="submit" className="min-h-12 w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>
                <p className="text-center text-sm">
                  <Link to="/sign-in" className="text-muted-foreground hover:text-foreground">
                    Back to sign in
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
