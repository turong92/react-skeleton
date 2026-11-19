import { Alert, Button, Card } from '@skeleton/ui'
import type { ReactNode } from 'react'
import type { HoldSnapshot } from './holdController'
import { formatClock, formatMoney } from './format'
import { defaultBookingLabels, type BookingLabels } from './labels'
import styles from './HoldPanel.module.css'

export type HoldPaymentContext = {
  holdId: string
  amount: number
  currency?: string
}

export type HoldPanelProps = {
  hold: HoldSnapshot
  /** 보류 남은 시간(ms, 서버 시계 기준). 모르면 null */
  remainingMs: number | null
  currency?: string
  locale?: string
  /** 결제 시작을 눌렀다 */
  onCheckout: () => void
  /** 무료 확정을 눌렀다 */
  onConfirm: () => void
  /** 나가기 - 모두 놓기 */
  onLeave: () => void
  onDismissProblem?: () => void
  /**
   * 결제를 시작한 뒤 결제 자리 - 앱이 `@skeleton/payment` 의 결제창을 끼운다(패키지끼리 import 하지 않는다).
   * 주문은 `POST /payments/orders {itemType: "booking", itemRef: holdId}` + `Idempotency-Key`. 결제창을 닫아도 보류는 그대로 두고 다시 결제할 수 있다.
   */
  renderPayment?: (context: HoldPaymentContext) => ReactNode
  labels?: BookingLabels
}

/** 내 보류 - 고른 자리 · 금액 · 남은 시간 · 무료 확정 또는 결제 · 나가기. 시간이 0 이 되면 확정 · 결제가 잠기고 풀렸다고 알린다 */
export function HoldPanel({
  hold: state,
  remainingMs,
  currency,
  locale,
  onCheckout,
  onConfirm,
  onLeave,
  onDismissProblem,
  renderPayment,
  labels = defaultBookingLabels,
}: HoldPanelProps) {
  const L = labels.hold
  const hold = state.hold
  const expired = remainingMs !== null && remainingMs <= 0
  const paid = hold?.amount !== undefined
  const confirmed = hold?.status === 'CONFIRMED'
  return (
    <Card title={L.title} className={styles.panel}>
      {state.problem && (
        <Alert tone="warning" onDismiss={onDismissProblem} dismissLabel="×">
          {labels.problems[state.problem]}
        </Alert>
      )}
      {!hold || hold.seats.length === 0 ? (
        <p className={styles.empty}>{L.empty}</p>
      ) : (
        <>
          <ul className={styles.seats}>
            {hold.seats.map((seat) => (
              <li key={seat.id} className={styles.seatLine}>
                <span>{L.seatLine(seat)}</span>
                <span>
                  {seat.price === undefined ? L.free : formatMoney(seat.price, currency, locale)}
                </span>
              </li>
            ))}
          </ul>
          {paid && (
            <p className={styles.total}>
              {L.total} <strong>{formatMoney(hold.amount!, currency, locale)}</strong>
            </p>
          )}
          {confirmed ? (
            <Alert tone="success">{L.confirmed}</Alert>
          ) : (
            <>
              {remainingMs !== null &&
                (expired ? (
                  <Alert tone="warning">{L.expired}</Alert>
                ) : (
                  <p className={styles.timer} role="timer" aria-live="off">
                    {L.remaining(formatClock(remainingMs))}
                  </p>
                ))}
              {state.locked && paid && <p className={styles.note}>{L.locked}</p>}
              <div className={styles.actions}>
                {!paid && (
                  <Button onClick={onConfirm} disabled={expired} loading={state.busy}>
                    {L.confirm}
                  </Button>
                )}
                {paid && !state.locked && (
                  <Button onClick={onCheckout} disabled={expired} loading={state.busy}>
                    {L.checkout}
                  </Button>
                )}
                <Button variant="secondary" onClick={onLeave} disabled={state.busy}>
                  {L.leave}
                </Button>
              </div>
              {paid &&
                state.locked &&
                !expired &&
                renderPayment?.({ holdId: hold.holdId, amount: hold.amount!, currency })}
            </>
          )}
        </>
      )}
    </Card>
  )
}
