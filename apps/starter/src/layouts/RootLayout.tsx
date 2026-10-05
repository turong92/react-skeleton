import { useAuth } from '@skeleton/auth'
import { ThemeToggle } from '@skeleton/theme'
import { AppShell, Button } from '@skeleton/ui'
import { Link, Outlet } from 'react-router-dom'

export function RootLayout() {
  const { status, logout } = useAuth()
  return (
    <AppShell
      brand={
        <Link to="/">
          <strong>starter</strong>
        </Link>
      }
      nav={
        <>
          <Link to="/">홈</Link>
          <Link to="/account">계정</Link>
        </>
      }
      actions={
        <>
          {status === 'authenticated' && (
            <Button variant="ghost" size="sm" onClick={logout}>
              로그아웃
            </Button>
          )}
          <ThemeToggle />
        </>
      }
    >
      <Outlet />
    </AppShell>
  )
}
