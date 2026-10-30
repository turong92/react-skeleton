import { RequireAuth, RequirePermission } from '@skeleton/auth'
import { BlockedNotice } from '../auth/BlockedNotice'
import { PermissionsFailedNotice } from '../auth/PermissionsFailedNotice'
import { accountRoutes } from '../auth/authRoutes'
import { Navigate, type RouteObject } from 'react-router-dom'
import { landingJsonLd } from '../landing/landingSeo'
import { AppFrame } from '../layouts/AppFrame'
import { InvitePage } from '../workspace/InvitePage'
import { WorkspaceLayout } from '../workspace/WorkspaceLayout'
import { WorkspaceSettingsPage } from '../workspace/WorkspaceSettingsPage'
import { NewWorkspacePage, WorkspacesHomePage } from '../workspace/WorkspacesHomePage'
import type { MessageKey } from '../i18n'
import type { SeoHandle } from '../seo/routeSeo'
import { AdminAccountsPage } from './AdminAccountsPage'
import { AdminAccountPage } from './AdminAccountPage'
import { AdminBadgeAwardsPage } from './AdminBadgeAwardsPage'
import { AdminBadgesPage } from './AdminBadgesPage'
import { AdminCampaignsPage } from './AdminCampaignsPage'
import { AdminCatalogPage } from './AdminCatalogPage'
import { AdminCatalogProductPage } from './AdminCatalogProductPage'
import { AdminCouponDefinitionPage } from './AdminCouponDefinitionPage'
import { AdminCouponDefinitionsPage } from './AdminCouponDefinitionsPage'
import { AdminDashboardPage } from './AdminDashboardPage'
import { AdminPointsPage } from './AdminPointsPage'
import { AdminRewardGrantsPage } from './AdminRewardGrantsPage'
import { AdminRolesPage } from './AdminRolesPage'
import { AdminWorkspacesPage } from './AdminWorkspacesPage'
import { AdminPaymentPage } from './AdminPaymentPage'
import { AdminPaymentsPage } from './AdminPaymentsPage'
import { BadgesPage } from './BadgesPage'
import { BoardFormPage } from './BoardFormPage'
import { BoardPage } from './BoardPage'
import { BoardPostPage } from './BoardPostPage'
import { CheerPage } from './CheerPage'
import { CheersPage } from './CheersPage'
import { CouponsPage } from './CouponsPage'
import { HomeRoute } from './HomeRoute'
import { LegalRoute } from './LegalRoute'
import { NoteDetailPage } from './NoteDetailPage'
import { NoteFormPage } from './NoteFormPage'
import { NotesPage } from './NotesPage'
import { NotFoundPage } from './NotFoundPage'
import { PaymentDetailPage } from './PaymentDetailPage'
import { PaymentReturnPage } from './PaymentReturnPage'
import { ProfilePage } from './ProfilePage'
import { RewardsPage } from './RewardsPage'
import { SettingsPage } from './SettingsPage'
import { SubscribePage } from './SubscribePage'
import { SubscriptionPage } from './SubscriptionPage'
import { SubscriptionReturnPage } from './SubscriptionReturnPage'

const publicSeo = (
  titleKey: MessageKey,
  descriptionKey: MessageKey,
  extra: Partial<SeoHandle['seo']> = {},
): SeoHandle => ({ seo: { titleKey, descriptionKey, indexable: true, ...extra } })
/** 로그인 뒤 화면 · 로그인 · 404 — 검색에서 뺀다(`noindex, nofollow`, canonical 없음) */
const hiddenSeo = (titleKey: MessageKey, descriptionKey: MessageKey): SeoHandle => ({
  seo: { titleKey, descriptionKey, indexable: false },
})
const privateSeo = (titleKey: MessageKey) => hiddenSeo(titleKey, 'seo.app.description')

/**
 * 라우트 정의 — path → page 매핑은 여기. 로그인해야 보이는 화면은 `RequireAuth` 아래(비로그인은 `/login`, 돌아올 위치를 기억한다).
 * `/` 는 누구에게나 열려 있고 로그인 여부로 랜딩 · 대시보드가 갈린다(`HomeRoute`). 약관 · 방침 · 404 도 공개.
 * 모든 라우트에 `handle.seo`(검색 · 공유 미리보기)를 단다 — 공개 페이지는 노출, 나머지는 `noindex`(`routes.test.tsx` 가 지킨다).
 * `/notes/new` 는 `/notes/:id` 보다 먼저 맞는다(React Router 가 더 구체적인 경로를 고른다) — `/board/new` 도 같다.
 */
export const routes: RouteObject[] = [
  {
    element: <AppFrame />,
    children: [
      {
        path: '/',
        element: <HomeRoute />,
        handle: publicSeo('seo.landing.title', 'seo.landing.description', {
          jsonLd: landingJsonLd,
        }),
      },
      // 로그인 · 가입 · 메일 확인 · 비밀번호 재설정 · 링크 로그인 · 계정 설정(`@skeleton/auth` 의 `createAuthRoutes` — 방법은 `auth/authConfig.ts`)
      ...accountRoutes,
      {
        path: '/terms',
        element: <LegalRoute doc="terms" />,
        handle: publicSeo('seo.terms.title', 'seo.terms.description'),
      },
      {
        path: '/privacy',
        element: <LegalRoute doc="privacy" />,
        handle: publicSeo('seo.privacy.title', 'seo.privacy.description'),
      },
      {
        path: '/refund',
        element: <LegalRoute doc="refund" />,
        handle: publicSeo('seo.refund.title', 'seo.refund.description'),
      },
      // 팀 초대 수락 - 메일의 링크(`/invite?token=…`)는 로그인 없이 열린다(미리보기). 로그인 · 가입은 이 화면이 보내고, 돌아와 수락한다
      { path: '/invite', element: <InvitePage />, handle: privateSeo('workspace.tabsLabel') },
      // 게시판은 로그인하지 않아도 열린다(서버 `allow-anonymous-read`) - 읽기는 누구나, 쓰기는 로그인했거나 게시판이 비회원 쓰기를 허락할 때(화면이 가린다). 검색에는 노출하지 않는다
      { path: '/board', element: <BoardPage />, handle: privateSeo('nav.board') },
      { path: '/board/new', element: <BoardFormPage />, handle: privateSeo('nav.board') },
      { path: '/board/:id', element: <BoardPostPage />, handle: privateSeo('nav.board') },
      { path: '/board/:id/edit', element: <BoardFormPage />, handle: privateSeo('nav.board') },
      // 프로필 배지 - 로그인 없이 읽는다(견본 앱이 서버 `skeleton.badge.http.allow-anonymous-read: true` 로 켠다). 주소에 계정 id 가 있어 검색에 내지 않고, 필명 화면에는 붙이지 않는다
      {
        path: '/profile/:accountId',
        element: <ProfilePage />,
        handle: privateSeo('profile.title'),
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/notes', element: <NotesPage />, handle: privateSeo('nav.notes') },
          { path: '/notes/new', element: <NoteFormPage />, handle: privateSeo('nav.notes') },
          { path: '/notes/:id', element: <NoteDetailPage />, handle: privateSeo('nav.notes') },
          {
            path: '/notes/:id/edit',
            element: <NoteFormPage />,
            handle: privateSeo('nav.notes'),
          },
          // 워크스페이스(팀) - 팀은 주소의 slug 에서 읽는다(`/w/:slug/…`, 탭마다 독립). `/workspaces` 는 첫 화면(마지막에 쓴 팀으로 보낸다)
          {
            path: '/workspaces',
            element: <WorkspacesHomePage />,
            handle: privateSeo('workspace.tabsLabel'),
          },
          {
            path: '/workspaces/new',
            element: <NewWorkspacePage />,
            handle: privateSeo('workspace.tabsLabel'),
          },
          {
            path: '/w/:slug',
            element: <WorkspaceLayout />,
            handle: privateSeo('workspace.tabsLabel'),
            children: [
              { index: true, element: <Navigate to="notes" replace /> },
              { path: 'notes', element: <NotesPage />, handle: privateSeo('nav.notes') },
              { path: 'notes/new', element: <NoteFormPage />, handle: privateSeo('nav.notes') },
              { path: 'notes/:id', element: <NoteDetailPage />, handle: privateSeo('nav.notes') },
              {
                path: 'notes/:id/edit',
                element: <NoteFormPage />,
                handle: privateSeo('nav.notes'),
              },
              {
                path: 'settings',
                element: <WorkspaceSettingsPage />,
                handle: privateSeo('nav.settings'),
              },
            ],
          },
          // 응원하기 — 결제는 `@skeleton/payment`. `/payments/return` 은 `/payments/:id` 보다 먼저 맞는다(정적 경로가 앞선다)
          { path: '/cheer', element: <CheerPage />, handle: privateSeo('nav.cheer') },
          {
            path: '/payments/return',
            element: <PaymentReturnPage />,
            handle: privateSeo('cheer.return.title'),
          },
          { path: '/cheers', element: <CheersPage />, handle: privateSeo('cheer.history.title') },
          {
            path: '/payments/:id',
            element: <PaymentDetailPage />,
            handle: privateSeo('cheer.detail.title'),
          },
          // 구독 — 결제는 `@skeleton/payment`. 백엔드 `skeleton.payment.subscription.enabled=true` 가 있어야 열린다
          {
            path: '/subscribe',
            element: <SubscribePage />,
            handle: privateSeo('nav.subscription'),
          },
          {
            path: '/subscriptions/return',
            element: <SubscriptionReturnPage />,
            handle: privateSeo('subscription.return.title'),
          },
          {
            path: '/subscription',
            element: <SubscriptionPage />,
            handle: privateSeo('subscription.title'),
          },
          // 혜택 — 출석 · 친구 초대 · 쿠폰함 · 포인트(`@skeleton/rewards`). 백엔드 `campaign` · `coupon` · `point` 모듈을 붙인 만큼 열린다
          { path: '/rewards', element: <RewardsPage />, handle: privateSeo('nav.rewards') },
          {
            path: '/rewards/coupons',
            element: <CouponsPage />,
            handle: privateSeo('rewards.coupons.title'),
          },
          {
            path: '/rewards/badges',
            element: <BadgesPage />,
            handle: privateSeo('rewards.badges.title'),
          },
          { path: '/settings', element: <SettingsPage />, handle: privateSeo('nav.settings') },
          {
            element: (
              <RequirePermission
                anyOf={['dashboard.read']}
                forbidden={<BlockedNotice />}
                failed={<PermissionsFailedNotice />}
              />
            ),
            children: [
              // 관리자 대시보드 — 백엔드 `skeleton.dashboard.admin.enabled`
              {
                path: '/admin/dashboard',
                element: <AdminDashboardPage />,
                handle: privateSeo('nav.adminDashboard'),
              },
            ],
          },
          {
            element: (
              <RequirePermission
                anyOf={['account.read']}
                forbidden={<BlockedNotice />}
                failed={<PermissionsFailedNotice />}
              />
            ),
            children: [
              {
                path: '/admin/accounts',
                element: <AdminAccountsPage />,
                handle: privateSeo('nav.account'),
              },
              {
                path: '/admin/accounts/:id',
                element: <AdminAccountPage />,
                handle: privateSeo('nav.account'),
              },
            ],
          },
          {
            element: (
              <RequirePermission
                anyOf={['authz.roles']}
                forbidden={<BlockedNotice />}
                failed={<PermissionsFailedNotice />}
              />
            ),
            children: [
              {
                path: '/admin/roles',
                element: <AdminRolesPage />,
                handle: privateSeo('nav.adminRoles'),
              },
            ],
          },
          {
            element: (
              <RequirePermission
                anyOf={['workspace.read']}
                forbidden={<BlockedNotice />}
                failed={<PermissionsFailedNotice />}
              />
            ),
            children: [
              // 운영자 워크스페이스 목록(읽기만) — 백엔드 `skeleton.workspace.admin.enabled`
              {
                path: '/admin/workspaces',
                element: <AdminWorkspacesPage />,
                handle: privateSeo('nav.adminWorkspaces'),
              },
            ],
          },
          {
            element: (
              <RequirePermission
                anyOf={['payment.read']}
                forbidden={<BlockedNotice />}
                failed={<PermissionsFailedNotice />}
              />
            ),
            children: [
              // 운영자 결제 도구 — 백엔드 `skeleton.payment.admin.enabled`. 정적 경로가 아니므로 `:id` 는 목록 뒤에
              {
                path: '/admin/payments',
                element: <AdminPaymentsPage />,
                handle: privateSeo('nav.adminPayments'),
              },
              {
                path: '/admin/payments/:id',
                element: <AdminPaymentPage />,
                handle: privateSeo('nav.adminPayments'),
              },
            ],
          },
          {
            element: (
              <RequirePermission
                anyOf={['catalog.manage']}
                forbidden={<BlockedNotice />}
                failed={<PermissionsFailedNotice />}
              />
            ),
            children: [
              // 운영 상품 · 가격 — 백엔드 `skeleton.catalog.admin.enabled`
              {
                path: '/admin/catalog',
                element: <AdminCatalogPage />,
                handle: privateSeo('nav.adminCatalog'),
              },
              {
                path: '/admin/catalog/:code',
                element: <AdminCatalogProductPage />,
                handle: privateSeo('nav.adminCatalog'),
              },
            ],
          },
          {
            element: (
              <RequirePermission
                anyOf={['campaign.manage']}
                forbidden={<BlockedNotice />}
                failed={<PermissionsFailedNotice />}
              />
            ),
            children: [
              {
                path: '/admin/campaigns',
                element: <AdminCampaignsPage />,
                handle: privateSeo('nav.adminCampaigns'),
              },
            ],
          },
          {
            element: (
              <RequirePermission
                anyOf={['coupon.manage']}
                forbidden={<BlockedNotice />}
                failed={<PermissionsFailedNotice />}
              />
            ),
            children: [
              {
                path: '/admin/coupons',
                element: <AdminCouponDefinitionsPage />,
                handle: privateSeo('nav.adminCoupons'),
              },
              {
                path: '/admin/coupons/:id',
                element: <AdminCouponDefinitionPage />,
                handle: privateSeo('nav.adminCoupons'),
              },
            ],
          },
          {
            element: (
              <RequirePermission
                anyOf={['point.manage']}
                forbidden={<BlockedNotice />}
                failed={<PermissionsFailedNotice />}
              />
            ),
            children: [
              {
                path: '/admin/points',
                element: <AdminPointsPage />,
                handle: privateSeo('nav.adminPoints'),
              },
            ],
          },
          {
            element: (
              <RequirePermission
                anyOf={['badge.manage']}
                forbidden={<BlockedNotice />}
                failed={<PermissionsFailedNotice />}
              />
            ),
            children: [
              {
                path: '/admin/badges',
                element: <AdminBadgesPage />,
                handle: privateSeo('nav.adminBadges'),
              },
              {
                path: '/admin/badge-awards',
                element: <AdminBadgeAwardsPage />,
                handle: privateSeo('nav.adminBadgeAwards'),
              },
            ],
          },
          {
            element: (
              <RequirePermission
                anyOf={['reward.operate']}
                forbidden={<BlockedNotice />}
                failed={<PermissionsFailedNotice />}
              />
            ),
            children: [
              {
                path: '/admin/reward-grants',
                element: <AdminRewardGrantsPage />,
                handle: privateSeo('nav.adminRewardGrants'),
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
        handle: hiddenSeo('notFound.title', 'notFound.body'),
      },
    ],
  },
]
