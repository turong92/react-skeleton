import { AuthProvider } from '@skeleton/auth'
import { initTheme, ThemedToaster } from '@skeleton/theme'
import { ErrorBoundary } from '@skeleton/ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@skeleton/tokens/tokens.css'
import '@skeleton/ui/base.css'
import { queryClient } from './app/queryClient'
import { defaultAuthLabels, koAuthLabels } from '@skeleton/auth'
import { toast } from 'sonner'
import { onSessionEnded } from './auth/refresher'
import { authSession } from './auth/session'
import { EmailGate } from './auth/EmailGate'
import { LoginIdGate } from './auth/LoginIdGate'
import { LegalGate } from './legal/LegalGate'
import { getDevCountry } from './api/devCountry'
import { i18n } from './i18n'
import { initialLocale } from './i18n/initialLocale'
import { router } from './routes'
import { consent } from './consent/consent'
import { createAnalyticsLoader } from '@skeleton/marketing'

// 갱신이 안 돼 로그아웃되면(만료 · 재사용 감지 · 정지) 이유를 한 줄로 알린다 — 라우트 가드가 로그인으로 보낸다
onSessionEnded((reason) => {
  const labels = i18n.getLocale() === 'ko' ? koAuthLabels : defaultAuthLabels
  toast.info(labels.sessionEnded[reason])
})

// 방문 통계 - 환경변수가 있을 때만, GA 는 동의한 방문자만(없으면 아무것도 붙지 않는다). 읽는 쪽은 관리자 대시보드(`@skeleton/dashboard`)
const analytics = createAnalyticsLoader({
  consent,
  gaMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID,
  cfBeaconToken: import.meta.env.VITE_CF_BEACON_TOKEN,
})
analytics.start()
// 화면(라우트)이 바뀔 때마다 page_view - 인증 값을 뗀 주소로, 같은 주소는 한 번만
router.subscribe(() => analytics.trackPageView())

// 저장한 테마를 읽어 <html data-theme> 에 단다(@skeleton/theme 는 불러올 때 아무것도 하지 않는다)
initTheme()

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider session={authSession}>
            {/* 한 번에 하나, 순서는 서버 인터셉터와 같다 — 아이디 정하기 → 이메일 등록(쓰기 때: 막지 않고 쓰려 할 때 연다) → 약관 동의 → (닉네임: 막지 않는 띠 + 글쓰기 전 확인) */}
            <LoginIdGate>
              <EmailGate>
                <LegalGate>
                  <RouterProvider router={router} />
                </LegalGate>
              </EmailGate>
            </LoginIdGate>
          </AuthProvider>
          {/* 헤더의 종 · 메뉴를 덮지 않게 아래쪽에 */}
          <ThemedToaster position="bottom-right" />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

/** 저장한 선택이 있으면 그대로(`init`), 없을 때만 개발용 나라 → 브라우저 언어 → 영어 순으로 첫 언어를 정한다(저장하지 않는다) */
async function startLocale(): Promise<void> {
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem('notes:ui-locale')
  } catch {
    // 저장소를 못 쓰는 환경 - 고른 적이 없는 것으로 본다
  }
  if (stored) {
    await i18n.init()
    return
  }
  await i18n.setLocale(
    initialLocale({ devCountry: getDevCountry(), languages: navigator.languages }),
    { remember: false },
  )
}

// 저장한 언어 → (없으면 개발용 나라 → 브라우저 언어 → 영어)를 정하고(필요하면 사전을 불러온 뒤) 그린다 — 첫 화면이 깜박이지 않는다. 실패해도 기본 언어로 그린다
void authSession
  .restore() // 액세스 토큰은 없고 갱신 자격만 남은 탭(다른 탭이 로그인했다 · 쿠키 모드)을 되살린다
  .catch(() => undefined)
  .then(startLocale)
  .catch(() => undefined)
  .then(render)
