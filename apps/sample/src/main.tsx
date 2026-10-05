import { AuthProvider } from '@skeleton/auth'
import { initTheme, ThemedToaster } from '@skeleton/theme'
import { ErrorBoundary, showApiError } from '@skeleton/ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@skeleton/tokens/tokens.css'
import '@skeleton/ui/base.css'
import { createQueryClient } from './app/createQueryClient'
import { toastUnlessValidation } from './app/errorToast'
import { authSession } from './auth/session'
import { i18n } from './i18n'
import { router } from './routes'

// 쿼리/뮤테이션 에러는 전부 토스트로 — 폼 검증 실패(400)만 칸 아래에 보이므로 뺀다
export const queryClient = createQueryClient({
  // 문구는 부를 때 `i18n.t` 로 채운다 — 그 시점의 화면 언어로 나온다(@skeleton/ui 는 번역을 모른다)
  onError: toastUnlessValidation((error) =>
    showApiError(error, {
      messages: {
        copy: i18n.t('common.copy'),
        traceIdCopied: i18n.t('error.traceCopied'),
        clickToCopy: i18n.t('error.clickToCopy'),
      },
    }),
  ),
})

// 저장한 테마를 읽어 <html data-theme> 에 단다(@skeleton/theme 는 불러올 때 아무것도 하지 않는다)
initTheme()

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider session={authSession}>
            <RouterProvider router={router} />
          </AuthProvider>
          {/* 헤더의 종 · 메뉴를 덮지 않게 아래쪽에 */}
          <ThemedToaster position="bottom-right" />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

// 저장한 언어 → 브라우저 언어 → 기본 언어를 정하고(필요하면 사전을 불러온 뒤) 그린다 — 첫 화면이 깜박이지 않는다. 실패해도 기본 언어로 그린다
void i18n
  .init()
  .catch(() => undefined)
  .then(render)
