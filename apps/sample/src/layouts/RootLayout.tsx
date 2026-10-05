import { useAuth } from '@skeleton/auth'
import { NotificationBell } from '@skeleton/notifications'
import { ThemeToggle } from '@skeleton/theme'
import { AppShell, Button } from '@skeleton/ui'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../notifications/api'
import { useLiveNotifications } from '../notifications/useLiveNotifications'
import { strings } from '../strings'
import styles from './RootLayout.module.css'

/** 로그인한 사람만 보는 부분 — 실시간 알림 연결은 여기서 시작하고 로그아웃하면 함께 끊긴다 */
function SignedInActions() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  useLiveNotifications()

  function signOut() {
    logout()
    queryClient.clear() // 다음 사람에게 이전 사람의 노트가 보이지 않게
    navigate('/login', { replace: true })
  }

  return (
    <>
      <NotificationBell
        api={notificationsApi}
        title={strings.header.notificationsTitle}
        bellLabel={strings.header.bell}
        closeLabel={strings.common.close}
        markAllReadLabel={strings.header.markAllRead}
        loadingLabel={strings.common.loading}
        paginationLabels={{
          label: strings.notes.pagination.label,
          previousLabel: strings.header.previousPage,
          nextLabel: strings.header.nextPage,
        }}
        listProps={{
          markReadLabel: strings.header.markRead,
          emptyTitle: strings.header.notificationsEmptyTitle,
          emptyDescription: strings.header.notificationsEmptyBody,
        }}
      />
      <Button variant="ghost" size="sm" onClick={signOut}>
        {strings.header.signOut}
      </Button>
    </>
  )
}

export function RootLayout() {
  const { status } = useAuth()
  const signedIn = status === 'authenticated'
  return (
    <AppShell
      brand={
        <Link to="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            N
          </span>
          <strong>{strings.appName}</strong>
        </Link>
      }
      nav={
        signedIn && (
          <>
            <NavLink to="/" end>
              {strings.nav.dashboard}
            </NavLink>
            <NavLink to="/notes">{strings.nav.notes}</NavLink>
            <NavLink to="/board">{strings.nav.board}</NavLink>
            <NavLink to="/settings">{strings.nav.settings}</NavLink>
          </>
        )
      }
      actions={
        <>
          {signedIn && <SignedInActions />}
          <ThemeToggle />
        </>
      }
    >
      <Outlet />
    </AppShell>
  )
}
