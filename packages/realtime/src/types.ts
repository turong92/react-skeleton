/**
 * `paused` · `off` 는 SSE 클라이언트만 낸다 — 탭이 숨겨져 잠시 멈춤 · 401/403/404 로 영구 중지.
 */
export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'reconnecting'
  | 'open'
  | 'error'
  | 'paused'
  | 'off'
