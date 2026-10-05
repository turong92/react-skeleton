import { RequireAuth } from '@skeleton/auth'
import type { RouteObject } from 'react-router-dom'
import { RootLayout } from '../layouts/RootLayout'
import { AccountPage } from './AccountPage'
import { HomePage } from './HomePage'
import { LoginPage } from './LoginPage'
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
      { path: '/login', element: <LoginPage /> },
      { element: <RequireAuth />, children: [{ path: '/account', element: <AccountPage /> }] },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
