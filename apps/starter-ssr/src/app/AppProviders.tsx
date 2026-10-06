import type { ApiClient } from '@skeleton/api-client'
import type { ReconsentController } from '@skeleton/legal'
import { ThemedToaster } from '@skeleton/theme'
import { ErrorBoundary } from '@skeleton/ui'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiProvider } from '../api/ApiProvider'
import { AuthRoot } from '../auth/AuthRoot'
import type { Auth } from '../auth/createAuth'
import { LegalGate } from '../legal/LegalGate'

export type AppProvidersProps = {
  queryClient: QueryClient
  api: Pick<ApiClient, 'value' | 'list' | 'noContent' | 'page'>
  auth: Auth
  /** 약관 재동의 컨트롤러 — 서버 렌더도 같은 껍데기를 그리도록 늘 준다(서버에서는 아무 일도 일어나지 않는다) */
  reconsent: ReconsentController
  /** 서버는 `StaticRouter`, 브라우저는 `BrowserRouter` — 이 껍데기가 둘의 유일한 차이다(`AppRoutes` 를 안에 둔다) */
  children: ReactNode
}

/** 서버 렌더와 브라우저가 똑같이 쓰는 공급자들. 순서도 같아야 하이드레이션이 맞는다 */
export function AppProviders({ queryClient, api, auth, reconsent, children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={api}>
          <AuthRoot auth={auth}>
            <LegalGate controller={reconsent}>{children}</LegalGate>
          </AuthRoot>
          <ThemedToaster />
        </ApiProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
