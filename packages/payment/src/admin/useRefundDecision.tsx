import { useState, type ReactNode } from 'react'
import type { PaymentLabelsInput } from '../labels'
import type { PaymentAdminApi } from './adminApi'
import { useApproveRefund, useRejectRefund } from './adminHooks'
import { AdminRefundDialog } from './AdminRefundDialog'
import type { AdminRefund } from './types'

type Decision = { mode: 'approve' | 'reject'; refund: AdminRefund; refundable?: number }

export type UseRefundDecisionOptions = {
  labels?: PaymentLabelsInput
  locale?: string
  /**
   * 요청의 결제 한 건으로 가는 링크 — 목록에서 연 창이 준다(한 건 화면에서는 이미 그 결제를 보고 있다). 요청이 환불 안 됨으로 닫혔거나
   * 결과를 모를 때 오류 아래에 보인다.
   * 둘째 인자가 **버튼 모양 클래스**다 - 링크의 `className` 에 꼭 붙인다(날 `<a>` 는 글자로만 보인다)
   */
  orderLink?: (refund: AdminRefund, buttonLikeClassName: string) => ReactNode
  /** 승인 · 거절을 **보내는 순간** 한 번 부른다(답을 기다리지 않는다) - 한 건 화면이 `useSyncOrder` 의 `reset` 을 꽂아 맞춘 뒤의 안내를 거둔다 */
  onSend?: () => void
}

/**
 * 환불 요청 하나를 정하는 창을 훅에 이었다 — 「요청대로 환불하기」(돈이 나간다, `approve`)와 「요청 거절하기」(돈은 안 나간다, `reject`)가 늘 같은
 * 확인 창을 거친다. `start(mode, refund, refundable?)` 가 창을 열고(묵은 오류는 지운다), 성공하면 닫고 **오류로 끝나면 다시 연다**(일하는 중에 × 로 닫았어도 끝난 거절이 조용히 사라지지 않는다).
 * `approved` 는 방금 승인 호출이 돌려준 환불 줄(`SUCCEEDED` · `PENDING`) - 화면이 「환불했어요」라고 말하는 데 쓴다. 확인은 **고른 쪽 호출만** 부른다
 * (승인은 `approve` 만, 거절은 `reject` 만). 목록 · 한 건 화면이 함께 쓴다.
 *
 * - `refundable` 은 아는 화면(한 건)만 준다 — 요청이 남은 금액보다 크면 창이 화면에서도 막는다(서버가 최종 판단).
 * - **일하는 동안**에는 × · Esc 로 닫았다가 다시 열어도 진행 중 상태가 그대로다: 묵은 상태를 지우지 않고 같은 창이 일하는 중으로 열린다
 *   (그 사이 다른 요청의 결정을 누르면 진행 중인 창이 다시 열릴 뿐이다) — 풀린 확인을 또 눌러 승인이 두 번 나가지 않는다.
 */
export function useRefundDecision(
  api: PaymentAdminApi,
  { labels, locale, orderLink, onSend }: UseRefundDecisionOptions = {},
) {
  const approve = useApproveRefund(api)
  const reject = useRejectRefund(api)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [open, setOpen] = useState(false)
  const mutation = decision?.mode === 'reject' ? reject : approve

  function start(mode: Decision['mode'], refund: AdminRefund, refundable?: number) {
    if (approve.isPending || reject.isPending) {
      setOpen(true) // 일하는 중인 창을 다시 열 뿐 - 상태를 지우지 않는다
      return
    }
    approve.reset()
    reject.reset()
    setDecision({ mode, refund, ...(refundable !== undefined ? { refundable } : {}) })
    setOpen(true)
  }

  const dialog = decision && (
    <AdminRefundDialog
      open={open}
      mode={decision.mode}
      request={decision.refund}
      order={
        decision.refundable !== undefined ? { refundableAmount: decision.refundable } : undefined
      }
      busy={mutation.isPending}
      error={mutation.error}
      orderLink={orderLink && ((className) => orderLink(decision.refund, className))}
      onClose={() => setOpen(false)}
      onConfirm={(amount, endSubscription) => {
        onSend?.()
        const handlers = { onSuccess: () => setOpen(false), onError: () => setOpen(true) }
        // 고친 금액 · 「구독도 해지」를 끈 선택이 있을 때만 승인에 실린다 - 둘 다 없으면 본문 없이 보낸다
        if (decision.mode === 'approve')
          approve.mutate(
            amount !== undefined || endSubscription !== undefined
              ? {
                  id: decision.refund.id,
                  ...(amount !== undefined ? { amount } : {}),
                  ...(endSubscription !== undefined ? { endSubscription } : {}),
                }
              : decision.refund.id,
            handlers,
          )
        else reject.mutate(decision.refund.id, handlers)
      }}
      labels={labels}
      locale={locale}
    />
  )
  return {
    start,
    dialog,
    approved: approve.data,
    /** `approved` 를 **보낸** 때(`Date.now()` - 호출을 시작한 때다. 받은 때가 아니다) - 직접 환불의 답과 어느 쪽이 더 최근인지 가를 때 쓴다 */
    approvedAt: approve.isSuccess ? approve.submittedAt : undefined,
  }
}
