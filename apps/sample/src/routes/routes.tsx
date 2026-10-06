import { RequireAuth, RequireRole } from '@skeleton/auth'
import { BlockedNotice } from '../auth/BlockedNotice'
import { accountRoutes } from '../auth/authRoutes'
import type { RouteObject } from 'react-router-dom'
import { landingJsonLd } from '../landing/landingSeo'
import { AppFrame } from '../layouts/AppFrame'
import type { MessageKey } from '../i18n'
import type { SeoHandle } from '../seo/routeSeo'
import { AdminAccountsPage } from './AdminAccountsPage'
import { BoardFormPage } from './BoardFormPage'
import { BoardPage } from './BoardPage'
import { BoardPostPage } from './BoardPostPage'
import { HomeRoute } from './HomeRoute'
import { LegalRoute } from './LegalRoute'
import { NoteDetailPage } from './NoteDetailPage'
import { NoteFormPage } from './NoteFormPage'
import { NotesPage } from './NotesPage'
import { NotFoundPage } from './NotFoundPage'
import { SettingsPage } from './SettingsPage'

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
          { path: '/board', element: <BoardPage />, handle: privateSeo('nav.board') },
          { path: '/board/new', element: <BoardFormPage />, handle: privateSeo('nav.board') },
          { path: '/board/:id', element: <BoardPostPage />, handle: privateSeo('nav.board') },
          {
            path: '/board/:id/edit',
            element: <BoardFormPage />,
            handle: privateSeo('nav.board'),
          },
          { path: '/settings', element: <SettingsPage />, handle: privateSeo('nav.settings') },
          {
            element: <RequireRole roles={['ADMIN']} forbidden={<BlockedNotice />} />,
            children: [
              {
                path: '/admin/accounts',
                element: <AdminAccountsPage />,
                handle: privateSeo('nav.account'),
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
