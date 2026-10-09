import { useEffect, useRef, useState } from 'react'
import { createIntentKeys } from '../intentKeys'
import type { PaymentLabelsInput } from '../labels'
import type { Order } from '../ledgerTypes'
import type { PaymentAdminApi } from './adminApi'
import { useOperatorRefund } from './adminHooks'
import { AdminRefundDialog } from './AdminRefundDialog'
import { refundProblemOf } from './refundOutcome'
import { unsureVerdict, type UnsureState, type UnsureVerdict } from './unsureHold'
import type { OperatorRefundInput } from './types'

export type UseDirectRefundOptions = {
  /** 환불할 결제 - 금액 칸의 처음 값(남은 금액)과 409 문구를 고르는 열린 환불의 상태(`openRefundStatus`)를 쓴다 */
  order: Pick<Order, 'id' | 'amount' | 'refundableAmount'> &
    Partial<Pick<Order, 'openRefundStatus'>>
  labels?: PaymentLabelsInput
  locale?: string
  /**
   * 환불을 **보낸** 뒤 이만큼(ms)이 지나야 `forget()` 이 모름을 놓는다 - 기본은 환불 호출의 제한 시간(`OPERATOR_REFUND_TIMEOUT_MS`).
   * 첫 요청이 서버에서 아직 환불 줄을 만들기 전일 수 있는 동안에는 맞추기가 먼저 끝나도 잠금 · 키를 유지한다(시간 초과로 모름이 됐으면 유예는 이미 지나 있다)
   */
  unsureHoldMs?: number
  /** 모름이 된 뒤 최소한 기다리는 시간(ms) - 기본 15초(`UNSURE_FLOOR_MS`). 보낸 때가 실제로 나간 때가 아닐 수 있어서 둔 바닥이다 */
  unsureFloorMs?: number
  /**
   * 환불을 **보내는 순간** 한 번 부른다(답을 기다리지 않는다 - 결과를 모르는 환불도 돈이 나갔을 수 있다). 한 건 화면이 `useSyncOrder` 의 `reset` 을 여기에 꽂는다 -
   * 맞춘 뒤의 안내(「결제사와 맞췄어요」)는 그때까지의 사실이라, 보낸 뒤에는 환불이 어떻게 끝나든 맞춘 뒤의 말로 남기지 않는다
   */
  onSend?: () => void
}

/**
 * 직접 환불(돈이 나간다)을 확인 창(`AdminRefundDialog`)에 이었다 - `ask()` 가 창을 열고, 확인하면 `useOperatorRefund` 를 부른다.
 * `useRefundDecision` 의 짝이다. 돌려주는 것: `ask` · `dialog`(화면에 그릴 창) · `done`(방금 호출이 돌려준 환불 줄 - `SUCCEEDED` · `PENDING`, 화면이 「환불했어요」라고 말하는 데 쓴다) · `forget`.
 *
 * - 성공하면 창이 닫히고, **오류로 끝나면 창이 다시 열린다** - 일하는 중에 × 로 닫았어도 끝난 오류가 조용히 사라지지 않는다.
 * - **결과를 모르는 동안**(답 유실 · 시간 초과 · 5xx)에는 `ask()` 가 묵은 오류를 지우지 않는다: 창이 그 모름 건을 먼저 보여 주고 금액 · 사유는 잠겨 있다 -
 *   키는 의도(주문 · 사유 · 금액)별이라 다른 값을 보내면 새 키가 나가 이미 나간 부분 환불이 한 번 더 나간다. 같은 내용으로 다시 보내면 같은 키다.
 *   모름을 벗어나는 길: 같은 내용을 다시 보내 확정 답이나 성공을 받거나, 부모가 결과를 확인한 뒤(「결제사와 맞추기」가 끝난 뒤) `forget()` 을 부른다 - 모름 상태와 든 키를 함께 놓는다(그 뒤의 환불은 새로 정한 새 의도라 새 키).
 *   보낸 지 얼마 안 돼 못 놓았으면 `forget()` 이 그 사실(`{ kind: 'hold', waitMs }`)을 돌려준다 - 화면이 「보낸 환불이 아직 가는 중일 수 있어요」를 말하게(`AdminOrderPanel` 의 `syncHeld`).
 * - 일하는 중에 `ask()` 를 부르면 상태를 지우지 않고 같은 창을 다시 열 뿐이다.
 * - 일하는 중에는 금액 · 사유 칸도 읽기 전용이고, 잠긴 칸은 적던 글자가 아니라 **보낸 변수**를 보인다(`sent`). 닫아 둔 창이 확정 오류로 다시 열려도 보낸 값 그대로다.
 */
export function useDirectRefund(
  api: PaymentAdminApi,
  { order, labels, locale, unsureHoldMs, unsureFloorMs, onSend }: UseDirectRefundOptions,
) {
  const [keys] = useState(() => createIntentKeys())
  const refund = useOperatorRefund(api, keys)
  const [open, setOpen] = useState(false)
  const unsure = refund.isError && refundProblemOf(refund.error) === 'unknown'
  // `forget` 은 「결제사와 맞추기」가 끝난 뒤에야 불린다 - 누른 때의 렌더가 아니라 **그 순간**의 상태를 봐야 한다(그 사이 같은 키로 다시 보내는 중일 수 있다).
  // 유예의 기준은 마지막으로 **보낸** 때(`submittedAt`)다 - 다시 보내면 그 호출의 시각으로 바뀌어 유예도 다시 센다(값이 따로 쌓여 낡을 일이 없다)
  // 모름이 된 때 - 유예의 바닥을 센다(보낸 때가 실제로 나간 때가 아닐 수 있다). 같은 보내기에서 한 번만 적는다
  const unsureSeen = useRef({ sentAt: 0, at: 0 })
  const now = useRef<UnsureState>({
    unsure,
    pending: refund.isPending,
    sentAt: refund.submittedAt,
    unsureAt: 0,
  })
  useEffect(() => {
    if (unsure && unsureSeen.current.sentAt !== refund.submittedAt)
      unsureSeen.current = { sentAt: refund.submittedAt, at: Date.now() }
    now.current = {
      unsure,
      pending: refund.isPending,
      sentAt: refund.submittedAt,
      unsureAt: unsureSeen.current.at,
    }
  })

  function ask() {
    // 묵은 오류가 새 창에 남지 않게 - 보내는 중이거나 결과를 모르면 지우지 않는다(보낸 값 그대로 이어진다)
    if (!refund.isPending && !unsure) refund.reset()
    setOpen(true)
  }

  /**
   * 결과를 확인했다(「결제사와 맞추기」가 끝남) - 모름 상태와 **든 키**를 놓는다: 장부가 결제사와 맞았으니(나가 있던 환불은 환불 줄로 보인다) 그 뒤의 환불은
   * 운영자가 새로 정한 새 의도다. 그 순간 모름이 아니거나 같은 키로 다시 보내는 중이면 아무 일도 없다(보내는 중인 변경을 `reset()` 하지 않는다).
   * 보낸 지 `unsureHoldMs`(기본 환불 호출의 제한 시간)가 안 지났거나 모름이 된 지 15초가 안 지났으면 놓지 않고 `{ kind: 'hold', waitMs }` 를 돌려준다 - 첫 요청이 서버에서 아직 환불 줄을 만들기 전일 수 있다(`unsureVerdict`).
   * 돌려주는 값: `release`(놓았다) · `hold`(아직 - 몇 ms 뒤에 다시 맞추면 놓는다) · `none`(놓을 모름이 없었다)
   */
  function forget(): UnsureVerdict {
    const verdict = unsureVerdict(now.current, Date.now(), unsureHoldMs, unsureFloorMs)
    if (verdict.kind === 'release') {
      keys.clear()
      refund.reset()
    }
    return verdict
  }

  const dialog = (
    <AdminRefundDialog
      open={open}
      mode="direct"
      order={order}
      busy={refund.isPending}
      error={refund.error}
      sent={sentOf(refund.variables)}
      onClose={() => setOpen(false)}
      onConfirm={(input) => {
        onSend?.()
        refund.mutate(
          { orderId: order.id, ...input },
          {
            onSuccess: () => setOpen(false),
            onError: () => setOpen(true),
          },
        )
      }}
      labels={labels}
      locale={locale}
    />
  )
  return {
    ask,
    dialog,
    done: refund.data,
    /** `done` 을 **보낸** 때(`Date.now()` - 호출을 시작한 때다. 받은 때가 아니다) - 다른 호출의 답과 어느 쪽이 더 최근인지 가를 때 쓴다 */
    doneAt: refund.isSuccess ? refund.submittedAt : undefined,
    unsure,
    forget,
  }
}

/** 마지막으로 보낸 금액 · 사유 - 잠긴 칸이 적던 글자가 아니라 이것을 보인다 */
function sentOf(variables: OperatorRefundInput | undefined) {
  return variables?.amount === undefined
    ? undefined
    : { amount: variables.amount, reasonCode: variables.reasonCode }
}

/** `forget()` 이 못 놓았을 때 화면이 말할 기다림(초, 올림) - 놓았거나 놓을 것이 없었으면 `null` */
export function heldSecondsOf(verdict: UnsureVerdict): number | null {
  return verdict.kind === 'hold' ? Math.ceil(verdict.waitMs / 1000) : null
}
