import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

interface AuthActions {
  signIn(email: string, password: string): Promise<{ error?: AuthError }>
  signUp(email: string, password: string): Promise<{ error?: AuthError }>
  signOut(): Promise<{ error?: AuthError }>
  signInWithGoogle(): Promise<{ error?: AuthError }>
  resetPassword(email: string): Promise<{ error?: AuthError }>
}

type AuthContextValue = AuthState & AuthActions

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient()
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true })

  useEffect(() => {
    const client = getSupabaseClient()

    // Hydrate initial session
    client.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, loading: false })
    })

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (event, session) => {
      setState({ user: session?.user ?? null, session, loading: false })

      // Auto-create user_profiles row on first sign-in
      if (event === 'SIGNED_IN' && session?.user) {
        await client
          .from('user_profiles')
          .upsert(
            { id: session.user.id, preferred_units: 'IMPERIAL' },
            { onConflict: 'id', ignoreDuplicates: true },
          )
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ?? undefined }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error ?? undefined }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error: error ?? undefined }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    return { error: error ?? undefined }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error: error ?? undefined }
  }

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signUp, signOut, signInWithGoogle, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export type RouterContext = { auth: AuthState }
