import { useState } from 'react'
import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isTauri } from '@tauri-apps/api/core'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export const Route = createFileRoute('/sign-in')({
  beforeLoad: ({ context }) => {
    if (context.auth.user || context.auth.isGuest) throw redirect({ to: '/' })
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
      router.navigate({ to: '/' })
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
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="secondary"
              className="min-h-12 w-full"
              onClick={async () => {
                setAuthError(null)
                const { error } = await auth.signInWithGoogle()
                if (error) setAuthError(error.message)
              }}
            >
              Continue with Google
            </Button>
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" {...register('password')} />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              {authError && <p className="text-sm text-destructive">{authError}</p>}
              <Button type="submit" className="min-h-12 w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            <div className="space-y-2 text-center text-sm">
              <Link
                to="/forgot-password"
                className="block text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
              <p className="text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link to="/sign-up" className="text-foreground hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
            {isTauri() && (
              <>
                <Separator />
                <Button
                  variant="ghost"
                  className="min-h-12 w-full text-muted-foreground"
                  onClick={() => {
                    auth.continueAsGuest()
                    router.navigate({ to: '/' })
                  }}
                >
                  Continue as Guest
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Your data stays on this device only.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
