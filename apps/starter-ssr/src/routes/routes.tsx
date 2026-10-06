import type { RouteObject } from 'react-router-dom'
import { helloQuery } from '../hooks/useHello'
import { RootLayout } from '../layouts/RootLayout'
import { accountRoutes } from '../auth/routes'
import { HomePage } from './HomePage'
import { LegalPage } from './LegalPage'
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
      // 로그인 · 가입 · 메일 확인 · 비밀번호 재설정 · 링크 로그인 · 계정 설정 — `auth/routes.tsx`. 모두 검색에서 뺀다
      ...accountRoutes((page) =>
        handle({
          title: page === 'account' ? '계정' : '로그인',
          description: '계정 화면.',
          robots: 'noindex',
        }),
      ),
      // 서버가 쥐는 약관 · 방침(백엔드 legal 모듈) — 문서는 브라우저가 불러와 채우므로 검색에서 뺀다(정적 약관이 필요하면 marketing 의 LegalDocumentPage)
      {
        path: '/legal/:type',
        element: <LegalPage />,
        handle: handle({
          title: '약관',
          description: '이용약관 · 개인정보 처리방침.',
          robots: 'noindex',
        }),
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
