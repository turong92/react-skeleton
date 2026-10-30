import { usePricing } from '../landing/usePricing'
import { useAuth, usePermission } from '@skeleton/auth'
import { NotificationBell } from '@skeleton/notifications'
import { ConsentBanner, SiteFooter, type FooterLink } from '@skeleton/marketing'
import { ThemeToggle } from '@skeleton/theme'
import { AppShell, Button, LanguageMenu } from '@skeleton/ui'
import { AdminMenu } from './AdminMenu'
import { hasPendingInvitation } from '@skeleton/workspace'
import { HeaderSearch } from './HeaderSearch'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, type ReactNode } from 'react'
import { TeamSwitcher } from '../workspace/TeamSwitcher'
import { NicknameGateProvider } from '../auth/NicknameGate'
import { NicknameNudge } from '../auth/NicknameNudge'
import { LinkButton } from '../components/LinkButton'
import { consent } from '../consent/consent'
import { notificationsApi } from '../notifications/api'
import { useLiveNotifications } from '../notifications/useLiveNotifications'
import { useT } from '../i18n'
import styles from './RootLayout.module.css'

const AUTH_SCREENS = ['/login', '/sign-up', '/verify-email', '/magic-link', '/auth/callback']

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
      <HeaderSearch />
      <NotificationBell
        api={notificationsApi}
        title={t('header.notificationsTitle')}
        bellLabel={(unread) => t('header.bell', { unread })}
        onOpen={(item) => item.link && navigate(item.link)}
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
          collapsedLabel: (count) => t('header.notificationCollapsed', { count }),
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

/** 운영자 화면으로 가는 메뉴 - 라우트 가드(`RequirePermission`)와 같은 판정이다. 항목마다 그 화면의 읽기 권한이 있을 때만 그린다 */
export function AdminLinks() {
  const { t } = useT()
  const canDashboard = usePermission('dashboard.read')
  const canPayments = usePermission('payment.read')
  const canCatalog = usePermission('catalog.manage')
  const canAccounts = usePermission('account.read')
  const canRoles = usePermission('authz.roles')
  const canCampaigns = usePermission('campaign.manage')
  const canCoupons = usePermission('coupon.manage')
  const canPoints = usePermission('point.manage')
  const canGrants = usePermission('reward.operate')
  const canBadges = usePermission('badge.manage')
  const canWorkspaces = usePermission('workspace.read')
  const canReviews = usePermission('review.moderate') || usePermission('review.reply')
  // 운영 화면이 하나도 없는 사람에게는 메뉴 자체가 없다
  if (
    !(
      canDashboard ||
      canPayments ||
      canCatalog ||
      canAccounts ||
      canRoles ||
      canCampaigns ||
      canCoupons ||
      canPoints ||
      canGrants ||
      canBadges ||
      canWorkspaces ||
      canReviews
    )
  )
    return null
  return (
    <AdminMenu label={t('nav.admin')}>
      {canDashboard && <NavLink to="/admin/dashboard">{t('nav.adminDashboard')}</NavLink>}
      {canPayments && <NavLink to="/admin/payments">{t('nav.adminPayments')}</NavLink>}
      {canCatalog && <NavLink to="/admin/catalog">{t('nav.adminCatalog')}</NavLink>}
      {canAccounts && <NavLink to="/admin/accounts">{t('nav.adminAccounts')}</NavLink>}
      {canRoles && <NavLink to="/admin/roles">{t('nav.adminRoles')}</NavLink>}
      {canCampaigns && <NavLink to="/admin/campaigns">{t('nav.adminCampaigns')}</NavLink>}
      {canCoupons && <NavLink to="/admin/coupons">{t('nav.adminCoupons')}</NavLink>}
      {canPoints && <NavLink to="/admin/points">{t('nav.adminPoints')}</NavLink>}
      {canGrants && <NavLink to="/admin/reward-grants">{t('nav.adminRewardGrants')}</NavLink>}
      {canBadges && <NavLink to="/admin/badges">{t('nav.adminBadges')}</NavLink>}
      {canBadges && <NavLink to="/admin/badge-awards">{t('nav.adminBadgeAwards')}</NavLink>}
      {canWorkspaces && <NavLink to="/admin/workspaces">{t('nav.adminWorkspaces')}</NavLink>}
      {canReviews && <NavLink to="/admin/reviews">{t('nav.adminReviews')}</NavLink>}
    </AdminMenu>
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
  const navigate = useNavigate()
  // 초대 링크로 와서 로그인 · 가입을 거쳤다 - 로그인된 순간 이 탭에 수락 안 한 초대 토큰이 있으면 `/invite` 로 돌려보내 이어서 수락하게 한다(가입 화면은 돌아올 곳을 잇지 않는다).
  // 로그인한 순간에 한 번만 - 수락을 미루고 다른 화면으로 가는 사람을 붙잡지 않는다
  const returned = useRef(false)
  useEffect(() => {
    if (!signedIn) returned.current = false
    // 로그인 · 가입 화면이 아직 자기 이동을 하는 중이면(가입 확인 뒤 `/` 로) 그 이동이 끝난 첫 화면에서 한다
    else if (!returned.current && !AUTH_SCREENS.some((p) => pathname.startsWith(p))) {
      returned.current = true
      if (pathname !== '/invite' && hasPendingInvitation()) navigate('/invite', { replace: true })
    }
  }, [signedIn, pathname, navigate])
  // 가격표가 없으면(카탈로그가 꺼졌거나 팔 상품이 없으면) 푸터의 「요금제」 링크도 없다
  const pricingOn = usePricing(!signedIn) !== null
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
                        ...(pricingOn ? [{ label: t('footer.pricing'), href: '/#pricing' }] : []),
                        { label: t('footer.faq'), href: '/#faq' },
                      ],
                    },
                  ]
            }
            legalLabel={t('footer.legalLabel')}
            legalLinks={[
              { label: t('footer.terms'), href: '/terms' },
              { label: t('footer.privacy'), href: '/privacy' },
              { label: t('footer.refund'), href: '/refund' },
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
              <NavLink to="/cheer">{t('nav.cheer')}</NavLink>
              <NavLink to="/rewards">{t('nav.rewards')}</NavLink>
              <NavLink to="/subscription">{t('nav.subscription')}</NavLink>
              <NavLink to="/settings">{t('nav.settings')}</NavLink>
              <TeamSwitcher />
              <AdminLinks />
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
