import {
  createErrorReporter,
  noopErrorReporter,
  type ApiClient,
  type ErrorReporter,
  type ErrorReporterOptions,
} from '@skeleton/api-client'

export type AppErrorReporterOptions = {
  /** `import.meta.env` — 환경변수는 앱이 읽어 넘긴다(패키지는 읽지 않는다) */
  env: Record<string, unknown>
  client: Pick<ApiClient, 'endpoint' | 'lastTraceId'>
  /** 전송을 바꿔 끼운다(테스트 · 다른 서비스) */
  send?: ErrorReporterOptions['send']
}

/**
 * 오류 보고처. **`VITE_ERROR_REPORT=true` 일 때만** 백엔드(`POST /client-errors`, 백엔드 `skeleton.alert.client-errors.enabled=true` 와 짝)로 보낸다 —
 * 백엔드 경로도 기본 꺼짐이라 둘을 함께 켠다. `VITE_APP_RELEASE` 는 앱 버전(빌드 식별자). Sentry 로 바꿀 때는 `ErrorReporter` 를 구현한 객체를 돌려주면 된다.
 */
export function createAppErrorReporter({
  env,
  client,
  send,
}: AppErrorReporterOptions): ErrorReporter {
  if (env.VITE_ERROR_REPORT !== 'true') return noopErrorReporter
  return createErrorReporter({
    endpoint: client.endpoint('/client-errors'),
    release: typeof env.VITE_APP_RELEASE === 'string' ? env.VITE_APP_RELEASE : undefined,
    getTraceId: client.lastTraceId,
    send,
  })
}
