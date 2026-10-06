import type { RouteObject } from 'react-router-dom'
import { RootLayout } from '../layouts/RootLayout'
import { accountRoutes } from '../auth/routes'
import { HomePage } from './HomePage'
import { NotFoundPage } from './NotFoundPage'

/**
 * 라우트 정의 — path → page 매핑은 여기.
 *
 * 새 페이지: 1) `src/routes/XxxPage.tsx` 2) 아래 `children` 에 한 줄.
 * 로그인해야 보이는 페이지는 `RequireAuth` 아래 `children` 에 둔다(비로그인은 `/login` 으로, 돌아올 위치를 기억한다).
 */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      // 로그인 · 가입 · 메일 확인 · 비밀번호 재설정 · 링크 로그인 · 계정 설정(/account 는 로그인한 사람만) — `auth/routes.tsx`
      ...accountRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
