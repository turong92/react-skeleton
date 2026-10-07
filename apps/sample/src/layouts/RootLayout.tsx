import { useAuth } from '@skeleton/auth'
import { NotificationBell } from '@skeleton/notifications'
import { ConsentBanner, SiteFooter, type FooterLink } from '@skeleton/marketing'
import { ThemeToggle } from '@skeleton/theme'
import { AppShell, Button, LanguageMenu } from '@skeleton/ui'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { NicknameGateProvider } from '../auth/NicknameGate'
import { NicknameNudge } from '../auth/NicknameNudge'
import { LinkButton } from '../components/LinkButton'
import { consent } from '../consent/consent'
import { notificationsApi } from '../notifications/api'
import { useLiveNotifications } from '../notifications/useLiveNotifications'
import { useT } from '../i18n'
import styles from './RootLayout.module.css'

/** 로그인한 사람만 보는 부분 — 실시간 알림 연결은 여기서 시작하고 로그아웃하면 함께 끊긴다 */
function SignedInActions() {
  const { t } = useT()
  const { logout } = useAuth()
  const navigate = useNavigate()
  useLiveNotifications()

  function signOut() {
    logout()
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

/** 푸터 링크 — 같은 페이지의 앵커(`/#pricing`)는 일반 `<a>`, 사이트 안 경로는 라우터 링크 */
function footerLink(link: FooterLink, children: ReactNode) {
  return link.href.startsWith('/#') ? (
    <a href={link.href} className={styles.footerLink}>
      {children}
    </a>
  ) : (
    <Link to={link.href} className={styles.footerLink}>
      {children}
    </Link>
  )
}

export function RootLayout() {
  const { t, locale, localeOptions, setLocale } = useT()
  const { status } = useAuth()
  const { pathname } = useLocation()
  const signedIn = status === 'authenticated'
  return (
    <>
      <AppShell
        footer={
          <SiteFooter
            brand={t('appName')}
            tagline={t('footer.tagline')}
            columns={
              signedIn
                ? []
                : [
                    {
                      title: t('footer.product'),
                      links: [
                        { label: t('footer.pricing'), href: '/#pricing' },
                        { label: t('footer.faq'), href: '/#faq' },
                      ],
                    },
                  ]
            }
            legalLabel={t('footer.legalLabel')}
            legalLinks={[
              { label: t('footer.terms'), href: '/terms' },
              { label: t('footer.privacy'), href: '/privacy' },
            ]}
            copyright={t('footer.copyright', { year: String(new Date().getFullYear()) })}
            renderLink={footerLink}
            extra={
              <Button size="sm" variant="ghost" onClick={() => consent.reset()}>
                {t('footer.cookieSettings')}
              </Button>
            }
          />
        }
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
            {!signedIn && pathname !== '/login' && (
              <LinkButton to="/login" variant="ghost">
                {t('header.signIn')}
              </LinkButton>
            )}
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
        {signedIn ? (
          <NicknameGateProvider>
            <NicknameNudge />
            <Outlet />
          </NicknameGateProvider>
        ) : (
          <Outlet />
        )}
      </AppShell>
      <ConsentBanner
        reserveSpace // 배너가 폼 · 제출 버튼을 가리지 않게 아래를 비워 둔다(모듈 기본은 꺼짐)
        store={consent}
        categories={[
          {
            id: 'necessary',
            label: t('consent.necessary.label'),
            description: t('consent.necessary.description'),
            required: true,
          },
          {
            id: 'analytics',
            label: t('consent.analytics.label'),
            description: t('consent.analytics.description'),
          },
        ]}
        labels={{
          title: t('consent.title'),
          description: t('consent.description'),
          acceptAll: t('consent.acceptAll'),
          rejectAll: t('consent.rejectAll'),
          customize: t('consent.customize'),
          save: t('consent.save'),
          alwaysOn: t('consent.alwaysOn'),
        }}
        policyLink={<Link to="/privacy">{t('consent.policy')}</Link>}
      />
    </>
  )
}
