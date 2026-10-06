import type { ApiClient } from '@skeleton/api-client'
import { ThemedToaster } from '@skeleton/theme'
import { ErrorBoundary } from '@skeleton/ui'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiProvider } from '../api/ApiProvider'
import { AuthRoot } from '../auth/AuthRoot'
import type { Auth } from '../auth/createAuth'

export type AppProvidersProps = {
  queryClient: QueryClient
  api: Pick<ApiClient, 'value' | 'list' | 'noContent' | 'page'>
  auth: Auth
  /** 서버는 `StaticRouter`, 브라우저는 `BrowserRouter` — 이 껍데기가 둘의 유일한 차이다(`AppRoutes` 를 안에 둔다) */
  children: ReactNode
}

/** 서버 렌더와 브라우저가 똑같이 쓰는 공급자들. 순서도 같아야 하이드레이션이 맞는다 */
export function AppProviders({ queryClient, api, auth, children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={api}>
          <AuthRoot auth={auth}>{children}</AuthRoot>
          <ThemedToaster />
        </ApiProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
