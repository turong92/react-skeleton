import { useAuth } from '@skeleton/auth'
import { NotificationBell } from '@skeleton/notifications'
import { ThemeToggle } from '@skeleton/theme'
import { AppShell, Button, LanguageMenu } from '@skeleton/ui'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../notifications/api'
import { useLiveNotifications } from '../notifications/useLiveNotifications'
import { useT } from '../i18n'
import styles from './RootLayout.module.css'

/** 로그인한 사람만 보는 부분 — 실시간 알림 연결은 여기서 시작하고 로그아웃하면 함께 끊긴다 */
function SignedInActions() {
  const { t } = useT()
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
        title={t('header.notificationsTitle')}
        bellLabel={(unread) => t('header.bell', { unread })}
        closeLabel={t('common.close')}
        markAllReadLabel={t('header.markAllRead')}
        loadingLabel={t('common.loading')}
        paginationLabels={{
          label: t('notes.pagination.label'),
          previousLabel: t('header.previousPage'),
          nextLabel: t('header.nextPage'),
        }}
        listProps={{
          markReadLabel: t('header.markRead'),
          emptyTitle: t('header.notificationsEmptyTitle'),
          emptyDescription: t('header.notificationsEmptyBody'),
        }}
      />
      <Button variant="ghost" size="sm" onClick={signOut}>
        {t('header.signOut')}
      </Button>
    </>
  )
}

export function RootLayout() {
  const { t, locale, localeOptions, setLocale } = useT()
  const { status } = useAuth()
  const signedIn = status === 'authenticated'
  return (
    <AppShell
      brand={
        <Link to="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            N
          </span>
          <strong>{t('appName')}</strong>
        </Link>
      }
      nav={
        signedIn && (
          <>
            <NavLink to="/" end>
              {t('nav.dashboard')}
            </NavLink>
            <NavLink to="/notes">{t('nav.notes')}</NavLink>
            <NavLink to="/board">{t('nav.board')}</NavLink>
            <NavLink to="/settings">{t('nav.settings')}</NavLink>
          </>
        )
      }
      actions={
        <>
          {signedIn && <SignedInActions />}
          <LanguageMenu
            label={t('language.label')}
            value={locale}
            options={localeOptions}
            onChange={(next) => void setLocale(next as typeof locale)}
          />
          <ThemeToggle />
        </>
      }
    >
      <Outlet />
    </AppShell>
  )
}
