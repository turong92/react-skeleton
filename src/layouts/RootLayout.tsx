import { Link, Outlet } from 'react-router-dom'

/**
 * 전체 페이지 레이아웃. 헤더 + 본문(<Outlet />) 구성.
 * 페이지별 레이아웃이 필요하면 `layouts/XxxLayout.tsx` 추가 후 해당 라우트에 wrapping.
 */
export function RootLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: '1rem 2rem',
          borderBottom: '1px solid #eee',
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'center',
        }}
      >
        <Link to="/" style={{ fontWeight: 700 }}>
          react-skeleton
        </Link>
      </header>
      <main style={{ flex: 1, padding: '2rem', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>
    </div>
  )
}
