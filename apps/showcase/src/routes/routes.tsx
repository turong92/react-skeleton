import { RequireAuth } from '@skeleton/auth'
import type { RouteObject } from 'react-router-dom'
import { ShowcaseLayout } from '../layouts/ShowcaseLayout'
import { AuthSecretPage } from '../demos/AuthSecretPage'
import { packageSections } from '../demos/packageSections'
import { TokensPage } from '../tokens/TokensPage'
import { UiPage } from '../ui/UiPage'
import { HomePage, NotFoundPage, PackagePage } from './pages'

/** 섹션마다 한 경로 — 패키지는 `packageSections` 에서 만든다 */
export const routes: RouteObject[] = [
  {
    element: <ShowcaseLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/ui', element: <UiPage /> },
      { path: '/tokens', element: <TokensPage /> },
      ...packageSections.map((section) => ({
        path: `/packages/${section.slug}`,
        element: <PackagePage section={section} />,
      })),
      {
        element: <RequireAuth redirectTo="/packages/auth" />,
        children: [{ path: '/packages/auth/secret', element: <AuthSecretPage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
