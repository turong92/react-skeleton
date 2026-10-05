import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section>
      <h1>404 — Not Found</h1>
      <p>요청하신 페이지를 찾을 수 없습니다.</p>
      <Link to="/">← 홈으로</Link>
    </section>
  )
}
