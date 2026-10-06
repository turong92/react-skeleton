import { createContext } from 'react'
import type { AuthSession } from './session'
import type { AuthState } from './types'

export type AuthContextValue = AuthState &
  Pick<
    AuthSession,
    'login' | 'socialLogin' | 'magicLinkLogin' | 'signIn' | 'restore' | 'logout' | 'refresh'
  >

export const AuthContext = createContext<AuthContextValue | null>(null)
