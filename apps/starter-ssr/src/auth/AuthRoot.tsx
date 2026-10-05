import { AuthProvider } from '@skeleton/auth'
import { useEffect, type ReactNode } from 'react'
import type { Auth } from './createAuth'
import { AuthRestoredContext } from './restoredContext'

function RestoreSession({ auth }: { auth: Auth }) {
  // effect 는 서버에서 돌지 않고 하이드레이션이 끝난 뒤에 돈다 — 그때 저장소의 토큰을 올린다
  useEffect(() => {
    auth.restore()
  }, [auth])
  return null
}

/** `AuthProvider` + 「저장소 복원이 끝났는가」를 내려주고, 하이드레이션 뒤에 복원을 시작한다 */
export function AuthRoot({ auth, children }: { auth: Auth; children: ReactNode }) {
  return (
    <AuthProvider session={auth.session}>
      <AuthRestoredContext.Provider value={auth}>
        {children}
        <RestoreSession auth={auth} />
      </AuthRestoredContext.Provider>
    </AuthProvider>
  )
}
