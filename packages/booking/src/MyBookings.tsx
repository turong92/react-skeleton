import { Alert, Button, Card } from '@skeleton/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BookingApi } from './bookingApi'
import { formatMoney } from './format'
import { defaultBookingLabels, type BookingLabels } from './labels'
import styles from './HoldPanel.module.css'

export type MyBookingsProps = {
  api: Pick<BookingApi, 'myHolds' | 'cancel'>
  locale?: string
  /** 풀 id → 통화(가격 표시용) */
  currencyOf?: (poolId: string) => string | undefined
  labels?: BookingLabels
}

/** 내 예약 - 확정된 것(무료는 취소할 수 있다, 유료는 결제 환불이 정본) · 자리를 못 받아 환불 중인 것 */
export function MyBookings({
  api,
  locale,
  currencyOf,
  labels = defaultBookingLabels,
}: MyBookingsProps) {
  const L = labels.mine
  const client = useQueryClient()
  const holds = useQuery({ queryKey: ['booking', 'mine'], queryFn: () => api.myHolds() })
  const cancel = useMutation({
    mutationFn: (holdId: string) => api.cancel(holdId),
    onSettled: () => client.invalidateQueries({ queryKey: ['booking', 'mine'] }),
  })
  const shown = (holds.data ?? []).filter(
    (h) => h.status === 'CONFIRMED' || h.status === 'UNFULFILLED',
  )
  return (
    <Card title={L.title}>
      {cancel.isError && <Alert tone="danger">{labels.problems.other}</Alert>}
      {holds.isSuccess && shown.length === 0 && <p className={styles.empty}>{L.empty}</p>}
      {shown.map((h) => (
        <section key={h.holdId} className={styles.panel}>
          <ul className={styles.seats}>
            {h.seats.map((seat) => (
              <li key={seat.id} className={styles.seatLine}>
                <span>{labels.hold.seatLine(seat)}</span>
                <span>
                  {seat.price === undefined
                    ? labels.hold.free
                    : formatMoney(seat.price, currencyOf?.(h.poolId), locale)}
                </span>
              </li>
            ))}
          </ul>
          {h.status === 'UNFULFILLED' && <Alert tone="warning">{L.unfulfilled}</Alert>}
          {h.status === 'CONFIRMED' &&
            (h.amount === undefined ? (
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  loading={cancel.isPending && cancel.variables === h.holdId}
                  onClick={() => cancel.mutate(h.holdId)}
                >
                  {L.cancel}
                </Button>
              </div>
            ) : (
              <p className={styles.note}>{L.paidNote}</p>
            ))}
        </section>
      ))}
    </Card>
  )
}
