import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { PaymentLedgerApi } from './ledgerApi'
import type { PaddlePrice, PaddlePricePreviewConfig, PaddleSdk } from './paddle'
import type { OrderListParams, QuoteInput } from './ledgerTypes'
import {
  abandonOrderMutation,
  confirmOrderMutation,
  createIntentKeys,
  createOrderMutation,
  orderQuery,
  type OrderQueryOptions,
  ordersQuery,
  paddlePricesQuery,
  paymentConfigQuery,
  quoteQuery,
  requestRefundMutation,
  withdrawRefundMutation,
} from './queries'

/** 결제를 쓸 수 있는가 · 테스트 결제인가 · 환불 요청이 켜졌는가(`GET /config`) */
export function usePaymentConfig(api: PaymentLedgerApi) {
  return useQuery(paymentConfigQuery(api))
}

/**
 * 할인 뒤 금액 견적(`POST /quote`) - 쿠폰을 고를 때마다 입력이 바뀌어 새로 묻는다. `enabled: false` 면 묻지 않는다.
 * 결제 전에 보여 주는 값일 뿐이라 서버가 주문 때 다시 계산한다. 오류 문장은 `discountErrorMessage`
 */
export function useQuote(
  api: Pick<PaymentLedgerApi, 'quote'>,
  input: QuoteInput,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({ ...quoteQuery(api, input), enabled, retry: false })
}

/**
 * 주문을 만든다. 훅이 「한 번의 의도」의 `Idempotency-Key` 를 들고 있다: 같은 입력(`itemType` · `itemRef` · `quantity`)을 다시 보내면
 * (연속 두 번 누름 · 네트워크 오류 뒤 다시 누름) 같은 키라 서버가 같은 주문을 돌려주고, 입력이 바뀌거나 성공하거나 10분이 지나면 새 키다.
 * 변수에 `idempotencyKey` 를 주면 그것이 이긴다. 성공하면 `data.checkout` 을 `openCheckout` 에 넘긴다. 누르는 동안(`isPending`) 단추는 막는다.
 * `options.meta` 는 이 호출의 뮤테이션에 그대로 붙는다 - 전역 에러 핸들러가 읽는 표식(예: 견본 앱의 `meta.quietStatuses: [429]` - 화면이 제자리에서 말하는 상태 코드는 토스트로 한 번 더 뜨지 않게)을 싣는 자리.
 */
export function useCreateOrder(
  api: PaymentLedgerApi,
  options?: { meta?: Record<string, unknown> },
) {
  const client = useQueryClient()
  const [keys] = useState(() => createIntentKeys())
  return useMutation({
    ...createOrderMutation(api, client, keys),
    ...(options?.meta ? { meta: options.meta } : {}),
  })
}

/**
 * 결제창에서 돌아온 결제를 승인한다 — `data.status` 가 `PAID` 또는 `CONFIRMING`. 거절은 `PAYMENT.DECLINED`(`declineDetail`).
 * **결과를 모르면(네트워크 오류 · 시간 초과 · 5xx · 401 갱신 실패) 같은 주문의 승인을 알아서 다시 보낸다**(`CONFIRM_RETRY_LIMIT` 번, 1초에서 두 배씩 10초까지) —
 * 서버는 `CONFIRMING` 이면 202, `PAID` 면 200 이고 결제사 멱등 키가 주문 id 라 두 번 결제되지 않는다. 다시 보내는 동안 `isPending` 이 그대로 `true`.
 * 확정된 답(402 `DECLINED` · 400 · 409 · 404)은 다시 보내지 않고 바로 `error` 가 된다. 끝나면 성공이든 실패든 캐시를 새로 고친다
 * (그러면 `useOrder` 가 서버의 진짜 상태를 읽고, `CONFIRMING` 이면 되묻는다). 오류의 뜻은 `confirmOutcomeOf(error)`.
 */
export function useConfirmOrder(api: PaymentLedgerApi) {
  const client = useQueryClient()
  return useMutation(confirmOrderMutation(api, client))
}

/** 결제창에서 그만뒀다(`failUrl` 로 돌아왔을 때). 끝나면 성공이든 실패든 캐시를 새로 고친다 */
export function useAbandonOrder(api: PaymentLedgerApi) {
  const client = useQueryClient()
  return useMutation(abandonOrderMutation(api, client))
}

/** 한 건 + 환불 줄. `CONFIRMING` 인 동안만 간격을 늘려 가며 다시 묻고, 끝 상태가 되거나 첫 답으로부터 `maxPollMs`(기본 5분)가 지나면 멈춘다(조회가 실패해도 시계는 간다). `PENDING` 은 되묻지 않는다 — 서버가 아직 승인 요청을 받지 않은 것이다. `id` 가 없으면 묻지 않는다 */
export function useOrder(
  api: PaymentLedgerApi,
  id: string | undefined,
  options?: OrderQueryOptions,
) {
  const query = orderQuery(api, id ?? '', options)
  return useQuery({ ...query, enabled: id !== undefined && id !== '' })
}

/** 내 결제 내역(커서 이어받기 — `fetchNextPage`) */
export function useOrders(api: PaymentLedgerApi, params: Omit<OrderListParams, 'cursor'> = {}) {
  return useInfiniteQuery(ordersQuery(api, params))
}

/** 환불을 요청한다(돈은 운영자가 움직인다). 변수 `{ orderId, reasonCode, amount?, idempotencyKey? }` — 키는 `useCreateOrder` 처럼 같은 입력이면 훅이 들고 있는 같은 키 */
export function useRequestRefund(api: PaymentLedgerApi) {
  const client = useQueryClient()
  const [keys] = useState(() => createIntentKeys())
  return useMutation(requestRefundMutation(api, client, keys))
}

/** 내 환불 요청을 거둔다(`REQUESTED` 일 때만) */
export function useWithdrawRefund(api: PaymentLedgerApi) {
  const client = useQueryClient()
  return useMutation(withdrawRefundMutation(api, client))
}

export type PaddlePrices = {
  /** `off`: 미리보기 값이 없다(결제사가 Paddle 이 아니거나 구버전 서버) · `loading` · `ready` · `failed` */
  status: 'off' | 'loading' | 'ready' | 'failed'
  /** 구매자 통화의 표시 금액(`$3.99`)과 Paddle 가격의 주기(`P1M`, 1회 가격은 `null`). 불러오는 중이거나 실패했거나 응답에 그 코드가 없으면 `undefined` - 이때 원화 표 금액으로 되돌아가지 않는다 */
  priceOf(code: string): PaddlePrice | undefined
}

/**
 * Paddle 로 결제할 화면의 금액 - Paddle.js 가격 미리보기가 돌려준 표시 금액을 상품 · 플랜 코드로 찾는다. [preview] 는 `usePaymentConfig` 의 `pricePreviews.paddle`.
 * 실패해도 던지지 않고 `failed` 로 알린다(화면이 금액을 숨기고 결제창에서 확인하라고 안내한다).
 */
export function usePaddlePrices(
  preview: PaddlePricePreviewConfig | undefined,
  loadSdk?: () => Promise<PaddleSdk>,
): PaddlePrices {
  const empty = { clientToken: '', environment: '', prices: {} }
  const query = useQuery({
    ...paddlePricesQuery(preview ?? empty, loadSdk),
    enabled: preview !== undefined && Object.keys(preview.prices).length > 0,
  })
  const status =
    preview === undefined ? 'off' : query.isError ? 'failed' : query.isSuccess ? 'ready' : 'loading'
  return { status, priceOf: (code) => query.data?.[code] }
}
