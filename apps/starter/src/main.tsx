import { AuthProvider } from '@skeleton/auth'
import { initTheme, ThemedToaster } from '@skeleton/theme'
import { ErrorBoundary, showApiError } from '@skeleton/ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@skeleton/tokens/tokens.css'
import '@skeleton/ui/base.css'
import { createQueryClient } from './app/createQueryClient'
import { authSession } from './auth/session'
import { router } from './routes'

const ENABLE_QUERY_DEVTOOLS =
  import.meta.env.DEV && import.meta.env.VITE_REACT_QUERY_DEVTOOLS === 'true'

// 쿼리/뮤테이션 에러는 전부 토스트로 — 문구를 바꾸려면 showApiError 의 messages 옵션
const queryClient = createQueryClient({ onError: (error) => showApiError(error) })

// 저장한 테마를 읽어 <html data-theme> 에 단다(@skeleton/theme 는 불러올 때 아무것도 하지 않는다)
initTheme()

// 액세스 토큰은 없고 갱신 자격만 남은 탭(다른 탭이 로그인했다 · 쿠키 모드)을 되살린 뒤 그린다
void authSession
  .restore()
  .catch(() => undefined)
  .then(render)

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider session={authSession}>
            <RouterProvider router={router} />
          </AuthProvider>
          <ThemedToaster />
          {ENABLE_QUERY_DEVTOOLS && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}
