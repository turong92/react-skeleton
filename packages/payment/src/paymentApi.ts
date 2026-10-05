import type { ApiClient } from '@skeleton/api-client'
import type {
  PaymentCancelRequest,
  PaymentConfirmRequest,
  PaymentOperationResult,
  PaymentRefundRequest,
  PaymentRoute,
  PaymentRouteQuery,
} from './types'

/*
 * 백엔드 `modules/payment` 는 서비스 계약(`PaymentService` · `PaymentProvider`)만 주고 HTTP 엔드포인트를 열지 않는다 —
 * 결제는 주문 · 금액 검증이 앱마다 달라 앱이 컨트롤러를 만든다. kotlin-skeleton 이 가진 유일한 HTTP 는 워크벤치의
 * 라우팅 확인용 `GET /skeleton/payments/route` 다. 그래서 이 패키지는 계약 타입과 얇은 호출만 주고, 경로는 앱이 알려 준다
 * (기본 경로 없음 — 없는 엔드포인트를 가정하지 않는다). 결제 UI 흐름(결제창 · 위젯)은 제공자 SDK 의 몫이라 여기에 없다.
 */

export type PaymentPaths = {
  /** `GET` — 라우팅 확인(워크벤치 데모 `/skeleton/payments/route`) */
  route?: string
  /** `POST` {@link PaymentConfirmRequest} → {@link PaymentOperationResult} */
  confirm?: string
  /** `POST` {@link PaymentCancelRequest} → {@link PaymentOperationResult} */
  cancel?: string
  /** `POST` {@link PaymentRefundRequest} → {@link PaymentOperationResult} */
  refund?: string
}

export type PaymentCallOptions = {
  /** 같은 결제를 두 번 처리하지 않게 — 헤더 `Idempotency-Key`(앱이 idempotency 모듈을 켰을 때). `newIdempotencyKey()` 는 api-client 에 있다 */
  idempotencyKey?: string
}

export type PaymentApi = {
  route?(query?: PaymentRouteQuery): Promise<PaymentRoute>
  confirm?(
    request: PaymentConfirmRequest,
    options?: PaymentCallOptions,
  ): Promise<PaymentOperationResult>
  cancel?(
    request: PaymentCancelRequest,
    options?: PaymentCallOptions,
  ): Promise<PaymentOperationResult>
  refund?(
    request: PaymentRefundRequest,
    options?: PaymentCallOptions,
  ): Promise<PaymentOperationResult>
}

/** 앱이 연 결제 엔드포인트를 부르는 얇은 호출. 경로를 준 것만 생긴다. 인증은 클라이언트의 `getAuthHeaders` */
export function createPaymentApi(
  client: Pick<ApiClient, 'value'>,
  { paths }: { paths: PaymentPaths },
): PaymentApi {
  const operation =
    <Request>(path: string) =>
    (request: Request, options: PaymentCallOptions = {}) =>
      client.value<PaymentOperationResult>(path, {
        method: 'POST',
        json: request,
        ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
      })
  const api: PaymentApi = {}
  if (paths.route) {
    const path = paths.route
    api.route = (query = {}) =>
      client.value<PaymentRoute>(path, {
        params: Object.fromEntries(
          Object.entries(query).filter(([, value]) => value !== undefined),
        ),
      })
  }
  if (paths.confirm) api.confirm = operation<PaymentConfirmRequest>(paths.confirm)
  if (paths.cancel) api.cancel = operation<PaymentCancelRequest>(paths.cancel)
  if (paths.refund) api.refund = operation<PaymentRefundRequest>(paths.refund)
  return api
}
