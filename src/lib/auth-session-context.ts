import { createContext } from 'react'

import type { AuthSession, AuthUser } from '@/types/auth'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  isAuthenticated: boolean
  refreshUser: () => Promise<void>
  signIn: (session: AuthSession) => void
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
