import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider } from 'react-router-dom'
import { ThemedToaster } from '@skeleton/theme'
import { ErrorBoundary } from '@skeleton/ui'
import '@skeleton/tokens/tokens.css'
import '@skeleton/ui/base.css'
import './workbench.css'
import { router } from './routes'
import { showApiError } from './lib/showApiError'

const ENABLE_QUERY_DEVTOOLS =
  import.meta.env.DEV && import.meta.env.VITE_REACT_QUERY_DEVTOOLS === 'true'

// 모든 쿼리/뮤테이션 에러를 자동으로 토스트로 노출 (컴포넌트 코드 덜 쓰게)
// 특정 쿼리에서 override 하고 싶으면 해당 useQuery 의 onError 등에서 e.preventDefault() 대신 별도 처리
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => showApiError(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => showApiError(error),
  }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary title="문제가 발생했습니다" retryLabel="다시 시도">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <ThemedToaster />
        {ENABLE_QUERY_DEVTOOLS && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
