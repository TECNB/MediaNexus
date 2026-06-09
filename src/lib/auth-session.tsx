import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  getCurrentUser,
  logout as requestLogout,
} from '@/lib/api/auth'
import {
  AUTH_TOKEN_CHANGE_EVENT,
  AUTH_TOKEN_STORAGE_KEY,
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from '@/lib/auth-token'
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from '@/lib/auth-session-context'
import type { AuthSession, AuthUser } from '@/types/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() =>
    getAuthToken() ? 'loading' : 'unauthenticated',
  )

  const clearSession = useCallback(() => {
    clearAuthToken()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const refreshUser = useCallback(async () => {
    if (!getAuthToken()) {
      setUser(null)
      setStatus('unauthenticated')
      return
    }

    setStatus((currentStatus) =>
      currentStatus === 'authenticated' ? currentStatus : 'loading',
    )

    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      setStatus('authenticated')
    } catch {
      clearSession()
    }
  }, [clearSession])

  const signIn = useCallback((session: AuthSession) => {
    setAuthToken(session.token)
    setUser(session.user)
    setStatus('authenticated')
  }, [])

  const signOut = useCallback(async () => {
    try {
      if (getAuthToken()) {
        await requestLogout()
      }
    } catch {
      // Local logout still owns the client session if the token has expired.
    } finally {
      clearSession()
    }
  }, [clearSession])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  useEffect(() => {
    function syncSessionFromToken() {
      if (!getAuthToken()) {
        setUser(null)
        setStatus('unauthenticated')
        return
      }

      void refreshUser()
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key === AUTH_TOKEN_STORAGE_KEY) {
        syncSessionFromToken()
      }
    }

    window.addEventListener(AUTH_TOKEN_CHANGE_EVENT, syncSessionFromToken)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener(AUTH_TOKEN_CHANGE_EVENT, syncSessionFromToken)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [refreshUser])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      refreshUser,
      signIn,
      signOut,
    }),
    [refreshUser, signIn, signOut, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
