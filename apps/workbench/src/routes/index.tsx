import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '../layouts/RootLayout'
import { HomePage } from './HomePage'
import { NotFoundPage } from './NotFoundPage'

/**
 * 라우트 정의.
 *
 * 새 페이지 추가 시:
 * 1. `src/routes/XxxPage.tsx` 생성 (기본 export 함수형 컴포넌트)
 * 2. 아래 `children` 배열에 `{ path: '/xxx', element: <XxxPage /> }` 추가
 * 3. 필요하면 NavBar ([RootLayout])에 링크 추가
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
