import { AuthProvider, createAuthSession, createTokenStore, type AuthApi } from '@skeleton/auth'
import { useMemo, type ReactNode } from 'react'

/** 테스트 전용 - 이 권한들을 가진 로그인 사용자로 감싼다(`/auth/me` 를 부르지 않는다: 로그인 응답이 권한을 이미 싣는다) */
export function OperatorSession({
  permissions = ['*'],
  children,
}: {
  permissions?: string[]
  children: ReactNode
}) {
  const session = useMemo(() => {
    const created = createAuthSession({ api: {} as AuthApi, store: createTokenStore() })
    created.signIn({
      accessToken: 'test-token',
      tokenType: 'Bearer',
      expiresAt: '2099-01-01T00:00:00Z',
      principal: { accountId: 'acc_op', roles: ['OPERATOR'], permissions },
    })
    return created
  }, [permissions])
  return <AuthProvider session={session}>{children}</AuthProvider>
}
