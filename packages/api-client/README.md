# @skeleton/api-client

백엔드(kotlin-skeleton `modules/platform`) REST 계약 클라이언트. axios 위에 envelope 검증 · `ApiError` 계약 · traceparent · 재시도를 얹었다.
**`import.meta.env` 도 모듈 전역 싱글턴도 없다** — 환경변수와 인스턴스는 앱이 만든다.

```ts
import { apiConfigFromEnv, createApiClient } from '@skeleton/api-client'

export const apiClient = createApiClient({
  ...apiConfigFromEnv(import.meta.env), // VITE_API_BASE_URL · _TIMEOUT_MS · _RETRY_ATTEMPTS · _RETRY_DELAY_MS
  debug: import.meta.env.DEV,
  getAuthHeaders: () => ({ Authorization: `Bearer ${token()}` }), // 보통 @skeleton/auth 의 createAuthHeadersProvider
  getTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone, // X-Time-Zone
  onResponseDate: (date) => serverClock.observeDateHeader(date), // 서버 시각 보정 연결점
  onError: (error) => {
    /* 401 처리 연결점 */
  },
})

const hello = await apiClient.value<{ message: string }>('/hello')
```

## `createApiClient(config)`

| 옵션                                                                             | 뜻                                                                                        |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `baseUrl`                                                                        | 필수. `/api/v1` 또는 절대 URL                                                             |
| `timeoutMs` · `retry: { attempts, delayMs, methods, statuses }`                  | 기본 15s · 재시도 없음(GET/HEAD/OPTIONS + 408/429/5xx 만 재시도 대상)                     |
| `getAuthHeaders`                                                                 | 요청마다 호출(동기/비동기). 요청의 `headers` 가 이긴다. 요청에 `skipAuth: true` 면 건너뜀 |
| `getTimeZone`                                                                    | `X-Time-Zone` 값. 없으면 헤더를 안 보낸다                                                 |
| `onResponseDate`                                                                 | 모든 응답(에러 포함)의 `Date` 헤더                                                        |
| `onError`                                                                        | 실패가 `ApiRequestError` 로 던져지기 직전에 한 번. 던져도 원래 에러가 나간다              |
| `debug`                                                                          | true 면 요청마다 콘솔 그룹 로그                                                           |
| `adapter` · `requestInterceptors` · `responseInterceptors` · `errorInterceptors` | axios 확장점(테스트 · 커스텀)                                                             |

반환: `value<T>` `list<T>` `page<T>` `cursor<T>` `basic`(본문은 `{ meta }`) `noContent`(204 — 본문 없는 삭제 · 명령) `envelope` `response`(status · headers · trace 까지) `endpoint(path)` `lastTraceId()`(마지막 요청의 traceId — 오류 보고용) `axios`.
요청 옵션: `method` `traceId` `idempotencyKey` `headers` `params` `json` `data` `timeoutMs` `signal` `skipAuth`.

## 그 밖의 export

| export                                                                    | 뜻                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ApiRequestError`                                                         | 4xx/5xx · 전송 실패. `apiError`(백엔드 `ApiError` 와 1:1) `traceId` `spanId` `traceparent`. 응답을 못 해석하면 `CLIENT.HTTP_ERROR`, 네트워크 실패는 `CLIENT.NETWORK_ERROR`(status 0)        |
| `chainForbiddenRecovery(...recoverers)`                                   | `recoverForbidden` 를 여럿(이메일 등록 · 약관 재동의)으로 묶는다 — 차례로 물어 처음 true 에서 멈춘다. 다시 보낸 호출이 **다른** 이유로 또 403 이면 한 번 더 풀고, 같은 이유면 거기서 끝낸다 |
| `ErrorCodes` · `ClientErrorCodes` · `isErrorCode(error, code \| codes[])` | 백엔드 Kotlin enum 에 있는 코드만                                                                                                                                                           |
| `createTraceContext(traceId?)` · `createTraceId()`                        | W3C traceparent                                                                                                                                                                             |
| `newIdempotencyKey()`                                                     | `Idempotency-Key` 용 — 같은 작업 재시도 때만 재사용                                                                                                                                         |
| `apiConfigFromEnv(env)`                                                   | 위 환경변수 → 설정                                                                                                                                                                          |
| 타입                                                                      | `ApiValueResponse` `ApiListResponse` `ApiPageResponse` `ApiCursorResponse` `ApiBasicResponse` `ApiError` `FieldError` …                                                                     |

## 사용자 기기의 오류를 서버로 (`createErrorReporter`)

지금까지 화면에서 난 오류는 사용자 기기의 콘솔에만 남아 아무도 몰랐다. 앱 · UI 는 `ErrorReporter`(`report(error, context?)` · `flush?()`) 인터페이스만 알고, 기본 구현이 kotlin-skeleton `alert` 모듈의 `POST /api/v1/client-errors`(백엔드에서 `skeleton.alert.client-errors.enabled=true` — **기본 꺼짐**)로 보낸다. 나중에 Sentry 로 바꿀 때는 같은 인터페이스를 구현한 객체를 꽂는다(화면 코드는 그대로).

```ts
const reporter = createErrorReporter({
  endpoint: apiClient.endpoint('/client-errors'),
  release: import.meta.env.VITE_APP_RELEASE, // 어느 배포에서 난 오류인지
  getTraceId: apiClient.lastTraceId, // 마지막 API 요청의 traceId — 서버 로그에서 같은 값으로 찾는다
})
installGlobalErrorReporting(reporter) // window 'error' · 'unhandledrejection' (+ 페이지를 떠날 때 flush). 끄는 함수를 돌려준다
// <ErrorBoundary reporter={reporter}> — 렌더 오류(@skeleton/ui)
```

| export                                  | 뜻                                                                                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createErrorReporter(options)`          | `endpoint`(필수) · `release` · `getTraceId` · `getRoute`(기본 `location.pathname`, 쿼리 없이) · `send`(전송 교체, 기본 `fetch` keepalive · 쿠키 없음) · `dedupeWindowMs`(60s) · `maxReports`(페이지당 20) |
| 접기                                    | 같은 오류(이름 · 메시지 · 스택 앞 두 줄)는 창 안에서 첫 건만 보내고 반복은 세어 두었다가 다음 보고(또는 `flush`)에 `count` 로 싣는다                                                                      |
| 앱을 지킨다                             | 전송 실패 · 오프라인 · 429 · 경로/trace 읽기 실패 · 동기 예외 모두 삼킨다. 큐 없이 버린다. 페이지가 보낼 수 있는 수에 상한                                                                                |
| `installGlobalErrorReporting(reporter)` | `window.onerror` 를 덮어쓰지 않고 이벤트로 듣는다. 서버 렌더(window 없음)에서는 아무것도 안 한다                                                                                                          |
| `noopErrorReporter`                     | 아무 데도 안 보낸다(꺼 둔 앱 · 테스트)                                                                                                                                                                    |

민감값은 서버도 지우지만(토큰 · 이메일 · URL 쿼리) **보내는 쪽이 비밀을 오류 메시지에 넣지 않는 것이 먼저**다. 이 전송은 일부러 `apiClient`(axios · 인증 헤더 · 401 복구)를 거치지 않는 `fetch` 한 번이다 — 보고가 로그인 갱신 같은 것을 일으키면 안 된다.

의존: `axios`(dependencies). 다른 `@skeleton/*` 를 쓰지 않는다.
