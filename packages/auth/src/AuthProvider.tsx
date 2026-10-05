import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { AuthContext } from './authContext'
import type { AuthSession } from './session'

/** `createAuthSession` 의 세션을 구독해 `useAuth()` 로 내려준다 */
export function AuthProvider({ session, children }: { session: AuthSession; children: ReactNode }) {
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)
  const value = useMemo(
    () => ({
      ...state,
      login: session.login,
      socialLogin: session.socialLogin,
      logout: session.logout,
      refresh: session.refresh,
    }),
    [state, session],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
