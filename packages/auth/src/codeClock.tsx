import type { ReactNode } from 'react'
import { CodeClockContext } from './codeClockContext'

/**
 * 인증번호 남은 시간을 세는 시계 — 앱이 서버 보정 시계를 넣는다(`createAuthRoutes({ now: () => serverClock.now().getTime() })`, 응답 `Date` 헤더로 맞춘
 * `@skeleton/time` 의 `createServerClock`). 안 넣으면 기기 시계(`Date.now`) — 기기 시계가 틀리면 남은 시간도 그만큼 틀린다.
 */
export function CodeClockProvider({ now, children }: { now: () => number; children: ReactNode }) {
  return <CodeClockContext.Provider value={now}>{children}</CodeClockContext.Provider>
}
