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

반환: `value<T>` `list<T>` `page<T>` `cursor<T>` `basic`(본문은 `{ meta }`) `noContent`(204 — 본문 없는 삭제 · 명령) `envelope` `response`(status · headers · trace 까지) `endpoint(path)` `axios`.
요청 옵션: `method` `traceId` `idempotencyKey` `headers` `params` `json` `data` `timeoutMs` `signal` `skipAuth`.

## 그 밖의 export

| export                                                                    | 뜻                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ApiRequestError`                                                         | 4xx/5xx · 전송 실패. `apiError`(백엔드 `ApiError` 와 1:1) `traceId` `spanId` `traceparent`. 응답을 못 해석하면 `CLIENT.HTTP_ERROR`, 네트워크 실패는 `CLIENT.NETWORK_ERROR`(status 0) |
| `ErrorCodes` · `ClientErrorCodes` · `isErrorCode(error, code \| codes[])` | 백엔드 Kotlin enum 에 있는 코드만                                                                                                                                                    |
| `createTraceContext(traceId?)` · `createTraceId()`                        | W3C traceparent                                                                                                                                                                      |
| `newIdempotencyKey()`                                                     | `Idempotency-Key` 용 — 같은 작업 재시도 때만 재사용                                                                                                                                  |
| `apiConfigFromEnv(env)`                                                   | 위 환경변수 → 설정                                                                                                                                                                   |
| 타입                                                                      | `ApiValueResponse` `ApiListResponse` `ApiPageResponse` `ApiCursorResponse` `ApiBasicResponse` `ApiError` `FieldError` …                                                              |

의존: `axios`(dependencies). 다른 `@skeleton/*` 를 쓰지 않는다.
