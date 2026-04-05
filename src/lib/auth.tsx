import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { isTauri } from '@tauri-apps/api/core'
import { getSupabaseClient } from './supabase'
import { getConfigStore } from './config-store'
import { handleConnectLink } from './deep-link-handler'
import { resetAdapter } from './adapter'
import { resetRealtimeManager } from './realtime-manager'
import { initSync, stopSync } from './sync-bridge'
import { useSyncStore } from '@/stores/sync-store'

// Guest mode is Tauri-only. In Tauri, the TauriAdapter writes to local SQLite
// using GUEST_USER_ID as the owner. In browser mode there is no local storage
// layer, so guest data would have nowhere to persist.
export const GUEST_USER_ID = 'guest-local'
const GUEST_STORAGE_KEY = 'ardent-forge-guest'
const SYNTHETIC_GUEST_USER = { id: GUEST_USER_ID, email: 'guest@local' } as unknown as User

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  isGuest: boolean
}

interface AuthActions {
  signIn(email: string, password: string): Promise<{ error?: AuthError }>
  signUp(email: string, password: string): Promise<{ error?: AuthError }>
  signOut(): Promise<{ error?: AuthError }>
  signInWithGoogle(): Promise<{ error?: AuthError }>
  resetPassword(email: string): Promise<{ error?: AuthError }>
  continueAsGuest(): boolean
}

type AuthContextValue = AuthState & AuthActions

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Read the client once for initialization only (loading state).
  // All auth methods call getSupabaseClient() fresh to avoid stale closures.
  const initialClient = getSupabaseClient()

  const requireClient = () => {
    const client = getSupabaseClient()
    if (!client) return null
    return client
  }

  // Eagerly restore guest session so we never flash the sign-in page.
  // localStorage is synchronous and safe to read during initialization.
  const isRestoredGuest = isTauri() && localStorage.getItem(GUEST_STORAGE_KEY) === 'true'

  const [state, setState] = useState<AuthState>(
    isRestoredGuest
      ? { user: SYNTHETIC_GUEST_USER, session: null, loading: false, isGuest: true }
      : { user: null, session: null, loading: !initialClient ? false : true, isGuest: false },
  )
  const [deepLinkFailed, setDeepLinkFailed] = useState(false)

  const continueAsGuest = (): boolean => {
    if (!isTauri()) {
      console.error('[auth] Guest mode is only available in Tauri')
      return false
    }
    setState({ user: SYNTHETIC_GUEST_USER, session: null, loading: false, isGuest: true })
    localStorage.setItem(GUEST_STORAGE_KEY, 'true')
    return true
  }

  useEffect(() => {
    const supabase = getSupabaseClient()

    // No supabase client means no config yet -- route guard will redirect to /setup
    if (!supabase) {
      setState((prev) => ({ ...prev, loading: false }))
      return
    }

    // Guest session was restored eagerly via useState -- skip Supabase hydration
    if (isRestoredGuest) return

    // Shared helper: initialize the Tauri sync engine from a session token.
    // Used by both SIGNED_IN and TOKEN_REFRESHED handlers to avoid duplication.
    const initSyncFromSession = (accessToken: string) => {
      getConfigStore()
        .getConfig()
        .then((config) => {
          if (!config) {
            console.warn('[sync] No backend config found, skipping sync init')
            return
          }
          return initSync(accessToken, config.supabaseUrl, config.supabaseKey)
        })
        .catch((err) => {
          console.error('[sync] Failed to initialize sync engine:', err)
          useSyncStore.getState().setSyncState('error', 'Failed to start sync')
        })
    }

    // Hydrate initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setState({ user: session?.user ?? null, session, loading: false, isGuest: false })
      })
      .catch((err) => {
        console.error('[auth] Failed to hydrate session:', err)
        setState({ user: null, session: null, loading: false, isGuest: false })
      })

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setState({ user: session?.user ?? null, session, loading: false, isGuest: false })

      if (event === 'SIGNED_IN' && session?.user) {
        resetAdapter()

        // Fire-and-forget: do NOT await here. The auth-js client awaits
        // onAuthStateChange callbacks during initialization, and PostgREST
        // queries call getSession() which awaits initializePromise. Awaiting
        // the upsert would create a circular deadlock.
        void (async () => {
          const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert(
              { id: session.user.id, preferred_units: 'IMPERIAL' },
              { onConflict: 'id', ignoreDuplicates: true },
            )
          if (profileError) {
            console.error('[auth] Failed to create user profile on sign-in:', profileError)
          }
        })().catch((err: unknown) => {
          console.error('[auth] Unexpected error creating profile:', err)
        })

        // Start Tauri sync engine with the fresh auth tokens
        if (isTauri() && session) {
          initSyncFromSession(session.access_token)
        }
      }

      if (event === 'SIGNED_OUT') {
        resetAdapter()
        resetRealtimeManager()

        if (isTauri()) {
          stopSync().catch((err) => {
            console.error('[sync] Failed to stop sync engine:', err)
            useSyncStore.getState().setSyncState('error', 'Failed to stop sync')
          })
        }
      }

      if (event === 'TOKEN_REFRESHED' && isTauri() && session) {
        initSyncFromSession(session.access_token)
      }
    })

    return () => subscription.unsubscribe()
  }, [isRestoredGuest])

  // Deep-link listener for Tauri OAuth callback
  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!isTauri() || !supabase) return

    let cleanup: (() => void) | undefined
    let cancelled = false

    void (async () => {
      try {
        const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
        const unlisten = await onOpenUrl(async (urls: string[]) => {
          for (const urlStr of urls) {
            try {
              const url = new URL(urlStr)

              if (url.hostname === 'connect') {
                try {
                  await handleConnectLink(urlStr)
                } catch (err) {
                  console.error('[auth] Connect deep-link failed:', err)
                }
                return
              }

              const code = url.searchParams.get('code')
              const oauthError = url.searchParams.get('error')

              if (oauthError) {
                console.error('[auth] OAuth provider returned error:', oauthError)
                window.location.href = '/sign-in?reason=oauth_error'
                return
              }

              if (code) {
                await supabase.auth.exchangeCodeForSession(code)
                // exchangeCodeForSession triggers onAuthStateChange(SIGNED_IN), which sets auth state, creates the user profile, and starts the sync engine
              } else {
                console.warn('[auth] Deep-link received without code or error:', urlStr)
                window.location.href = '/sign-in?reason=oauth_error'
              }
            } catch (err) {
              console.error('[auth] Deep-link processing error:', err)
              window.location.href = '/sign-in?reason=oauth_error'
            }
          }
        })
        if (cancelled) {
          unlisten()
        } else {
          cleanup = unlisten
        }
      } catch (err) {
        console.error('[auth] Failed to set up deep-link listener:', err)
        setDeepLinkFailed(true)
      }
    })()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const supabase = requireClient()
    if (!supabase)
      return {
        error: {
          message: 'No backend configured. Go to Settings to configure your backend.',
        } as AuthError,
      }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      localStorage.removeItem(GUEST_STORAGE_KEY)
    }
    return { error: error ?? undefined }
  }

  const signUp = async (email: string, password: string) => {
    const supabase = requireClient()
    if (!supabase)
      return {
        error: {
          message: 'No backend configured. Go to Settings to configure your backend.',
        } as AuthError,
      }
    const { error } = await supabase.auth.signUp({ email, password })
    if (!error) {
      localStorage.removeItem(GUEST_STORAGE_KEY)
    }
    return { error: error ?? undefined }
  }

  const signOut = async () => {
    localStorage.removeItem(GUEST_STORAGE_KEY)
    setState({ user: null, session: null, loading: false, isGuest: false })
    const supabase = requireClient()
    if (!supabase) return { error: undefined }
    const { error } = await supabase.auth.signOut()
    return { error: error ?? undefined }
  }

  const signInWithGoogle = async (): Promise<{ error?: AuthError }> => {
    const supabase = requireClient()
    if (!supabase)
      return {
        error: {
          message: 'No backend configured. Go to Settings to configure your backend.',
        } as AuthError,
      }

    if (isTauri()) {
      if (deepLinkFailed) {
        return {
          error: {
            message: 'Google sign-in is unavailable. Please use email sign-in.',
          } as AuthError,
        }
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'ardentforge://auth/callback',
          skipBrowserRedirect: true,
        },
      })
      if (error) return { error }

      if (!data?.url) {
        return {
          error: { message: 'Unable to start Google sign-in. Please try again.' } as AuthError,
        }
      }

      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(data.url, 'inAppBrowser')
      } catch (err) {
        console.error('[auth] Failed to open sign-in browser:', err)
        return {
          error: {
            message: 'Failed to open the sign-in browser. Please try again.',
          } as AuthError,
        }
      }

      return { error: undefined }
    }

    // Web: redirect-based OAuth flow
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error ?? undefined }
  }

  const resetPassword = async (email: string) => {
    const supabase = requireClient()
    if (!supabase)
      return {
        error: {
          message: 'No backend configured. Go to Settings to configure your backend.',
        } as AuthError,
      }
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error: error ?? undefined }
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        resetPassword,
        continueAsGuest,
      }}
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
