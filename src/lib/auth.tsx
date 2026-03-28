import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { isTauri } from '@tauri-apps/api/core'
import { getSupabaseClient } from './supabase'
import { initSync, stopSync } from './sync-bridge'
import { useSyncStore } from '@/stores/sync-store'

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
    // Hydrate initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setState({ user: session?.user ?? null, session, loading: false })
      })
      .catch((err) => {
        console.error('[auth] Failed to hydrate session:', err)
        setState({ user: null, session: null, loading: false })
      })

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setState({ user: session?.user ?? null, session, loading: false })

      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // Auto-create user_profiles row on first sign-in.
          // IMPERIAL is the default unit system per product spec.
          // ignoreDuplicates ensures existing profiles are preserved on subsequent sign-ins.
          const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert(
              { id: session.user.id, preferred_units: 'IMPERIAL' },
              { onConflict: 'id', ignoreDuplicates: true },
            )
          if (profileError) {
            console.error('[auth] Failed to create user profile on sign-in:', profileError)
          }
        } catch (err) {
          console.error('[auth] Unexpected error creating profile:', err)
        }

        // Start Tauri sync engine with the fresh auth tokens
        if (isTauri() && session) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
          const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
          if (!supabaseUrl || !supabaseKey) {
            console.warn(
              '[sync] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY, skipping sync init',
            )
          } else {
            initSync(session.access_token, supabaseUrl, supabaseKey).catch((err) => {
              console.error('[sync] Failed to initialize sync engine:', err)
              useSyncStore.getState().setSyncState('error', 'Failed to start sync')
            })
          }
        }
      }

      if (event === 'SIGNED_OUT') {
        if (isTauri()) {
          stopSync().catch((err) => {
            console.error('[sync] Failed to stop sync engine:', err)
          })
        }
      }

      if (event === 'TOKEN_REFRESHED' && isTauri() && session) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        if (!supabaseUrl || !supabaseKey) {
          console.warn(
            '[sync] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY, skipping sync init',
          )
        } else {
          initSync(session.access_token, supabaseUrl, supabaseKey).catch((err) => {
            console.error('[sync] Failed to initialize sync engine:', err)
            useSyncStore.getState().setSyncState('error', 'Failed to start sync')
          })
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

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
