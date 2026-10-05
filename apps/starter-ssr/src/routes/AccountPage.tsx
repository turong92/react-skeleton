import { useAuth } from '@skeleton/auth'
import { Card } from '@skeleton/ui'

/** `<RequireAuth />` 아래에 있어 로그인한 사람만 본다 */
export function AccountPage() {
  const { principal } = useAuth()
  return (
    <Card title="계정">
      <p>{principal?.email ?? principal?.username ?? principal?.accountId ?? '로그인됨'}</p>
      {principal && <code>{principal.roles.join(', ')}</code>}
    </Card>
  )
}
