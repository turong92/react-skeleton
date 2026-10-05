import type { RouteObject } from 'react-router-dom'
import { ClientRequireAuth } from '../auth/ClientRequireAuth'
import { helloQuery } from '../hooks/useHello'
import { RootLayout } from '../layouts/RootLayout'
import { AccountPage } from './AccountPage'
import { HomePage } from './HomePage'
import { LoginPage } from './LoginPage'
import { NotFoundPage } from './NotFoundPage'
import type { RouteHandle } from './routeMeta'

const handle = (value: RouteHandle) => value

/**
 * 라우트 정의 — path → page 매핑은 여기. 서버 렌더와 브라우저가 같은 표를 쓴다.
 *
 * 새 페이지: 1) `src/routes/XxxPage.tsx` 2) 아래 `children` 에 한 줄 — `handle` 에 제목 · 설명(필수), 첫 그림 전에 서버가
 * 미리 가져올 데이터가 있으면 `prefetch`(예: 홈). 로그인해야 보이는 페이지는 `ClientRequireAuth` 아래 `children` 에 둔다
 * (토큰은 브라우저에만 있어 서버는 중립 자리 표시만 그린다).
 */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <HomePage />,
        handle: handle({
          title: '홈',
          description: '서버가 첫 응답을 그려 보내고 브라우저가 이어받는 React 스타터.',
          prefetch: ({ queryClient, api }) => queryClient.prefetchQuery(helloQuery(api)),
        }),
      },
      {
        path: '/login',
        element: <LoginPage />,
        handle: handle({ title: '로그인', description: '계정으로 로그인합니다.' }),
      },
      {
        element: <ClientRequireAuth />,
        children: [
          {
            path: '/account',
            element: <AccountPage />,
            handle: handle({
              title: '계정',
              description: '로그인한 사용자의 계정 정보.',
              robots: 'noindex',
            }),
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
        handle: handle({
          title: '404 — 찾을 수 없음',
          description: '요청하신 페이지를 찾을 수 없습니다.',
          robots: 'noindex',
        }),
      },
    ],
  },
]
