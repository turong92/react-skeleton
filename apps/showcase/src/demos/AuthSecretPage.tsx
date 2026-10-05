import { useAuth } from '@skeleton/auth'
import { Card } from '@skeleton/ui'
import { Link } from 'react-router-dom'

/** `<RequireAuth />` 아래에 있어 로그인한 사람만 본다 */
export function AuthSecretPage() {
  const { principal } = useAuth()
  return (
    <Card title="비밀 페이지">
      <p>로그인한 사람만 보입니다: {principal?.email}</p>
      <Link to="/packages/auth">← 인증 데모로</Link>
    </Card>
  )
}
