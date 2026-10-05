import { initTheme } from '@skeleton/theme'
import { ErrorBoundary } from '@skeleton/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@skeleton/tokens/tokens.css'
import '@skeleton/ui/base.css'
import { router } from './routes'

// 저장한 테마를 읽어 <html data-theme> 에 단다(@skeleton/theme 는 불러올 때 아무것도 하지 않는다)
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary title="문제가 발생했습니다" retryLabel="다시 시도">
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
)
