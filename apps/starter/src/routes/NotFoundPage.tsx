import { EmptyState } from '@skeleton/ui'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <EmptyState
      headingLevel={2}
      title="404 — Not Found"
      description="요청하신 페이지를 찾을 수 없습니다."
      action={<Link to="/">← 홈으로</Link>}
    />
  )
}
