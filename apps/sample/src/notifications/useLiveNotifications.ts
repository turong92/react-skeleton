import { createAuthHeadersProvider } from '@skeleton/auth'
import { useNotificationIngest } from '@skeleton/notifications'
import { useSseClient } from '@skeleton/realtime'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { apiClient } from '../api/client'
import { emailRequired } from '../api/emailRequired'
import { subscribeGateRelease } from '../api/gateRelease'
import { loginIdRequired } from '../api/loginIdRequired'
import { reconsent } from '../api/reconsent'
import { refresher } from '../auth/refresher'
import { tokenStore } from '../auth/tokenStore'

const getAuthHeaders = createAuthHeadersProvider(tokenStore)

/**
 * 실시간 알림 — 백엔드 `notification-sse`(`/api/v1/notifications/sse`)에 붙어 받은편지함 캐시(안 읽은 수 · 열린 목록)를 갱신하고
 * 새 알림을 토스트로 알린다. 로그인한 화면에서만 부른다(끊기면 재연결은 `@skeleton/realtime` 이 한다).
 */
export function useLiveNotifications() {
  const ingest = useNotificationIngest({
    onNotification: (event) => {
      if (event.title) toast(event.title, { description: event.message ?? undefined })
    },
  })
  const sse = useSseClient({
    url: apiClient.endpoint('/notifications/sse'),
    // 백엔드 심장박동(notification-sse `heartbeat`, 견본 15초)의 세 배 동안 바이트가 없으면 죽은 연결로 보고 다시 잇는다
    idleTimeoutMs: 45_000,
    getAuthHeaders,
    // 액세스 토큰이 만료돼 401 이면 갱신하고 다시 잇는다 · 다른 요청이 토큰을 갱신하면 죽은 스트림을 다시 잇는다
    recoverUnauthorized: (failed) => refresher.refresh(failed),
    // 아이디 정하기 · 이메일 등록 · 약관 재동의 막이 열린 동안엔 이 스트림도 403 으로 멈춘다 — 막이 걷히면(토큰은 그대로다) 다시 잇는다
    subscribeAuthChanges: (onChange) => {
      const offToken = tokenStore.subscribe(onChange)
      const offGates = subscribeGateRelease([loginIdRequired, emailRequired, reconsent], onChange)
      return () => {
        offToken()
        offGates()
      }
    },
    onEvent: (event) => ingest(event.data),
  })
  const { start, stop } = sse
  useEffect(() => {
    void start()
    return stop
  }, [start, stop])
  return sse.status
}
