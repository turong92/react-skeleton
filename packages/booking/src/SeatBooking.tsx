import { Alert } from '@skeleton/ui'
import { useWaitingRoomEntry } from '@skeleton/waiting-room'
import { useEffect, type ReactNode } from 'react'
import type { BookingApi } from './bookingApi'
import { HoldPanel, type HoldPaymentContext } from './HoldPanel'
import { useRemainingMs, useSeatFeed, useSeatHold } from './hooks'
import { defaultBookingLabels, type BookingLabels } from './labels'
import { SeatMap } from './SeatMap'
import type { SeatStreamOptions } from './seatStream'
import type { Pool } from './types'
import styles from './SeatBooking.module.css'

export type SeatBookingProps = {
  api: Pick<
    BookingApi,
    | 'snapshot'
    | 'streamUrl'
    | 'addSeats'
    | 'removeSeat'
    | 'myHolds'
    | 'checkout'
    | 'release'
    | 'confirm'
  >
  /** 풀(`api.pool(id)`) - 대기실이 달려 있으면 입장권이 있어야 자리를 잡는다 */
  pool: Pick<Pool, 'id' | 'currency' | 'waitingRoomId'>
  /** 흐름의 로그인 헤더 등(한 번 만들어 둔다) */
  sse?: SeatStreamOptions['sse']
  /** 결제 시작 뒤 결제 자리 - `onPaid` 를 부르면 보류를 다시 읽어 확정된 모습을 보인다 */
  renderPayment?: (context: HoldPaymentContext & { onPaid: () => void }) => ReactNode
  locale?: string
  labels?: BookingLabels
}

/**
 * 좌석 예약 한 벌 - 배치도(`SeatMap`) + 내 보류(`HoldPanel`). 흐름과 스냅샷을 맞추고, 누르면 잡기 · 다시 누르면 놓기,
 * 남이 잡은 자리는 바로 선택 불가, 결제를 시작하면 자리를 고정하고 나가기만 열어 둔다.
 * 대기실을 단 풀은 `WaitingRoomGate` 안에 둔다 - 입장권이 없으면(입장 시간이 끝났으면) 자리를 새로 잡지 못한다(이미 잡은 보류는 마칠 수 있다).
 */
export function SeatBooking({
  api,
  pool,
  sse,
  renderPayment,
  locale,
  labels = defaultBookingLabels,
}: SeatBookingProps) {
  const requiresEntry = Boolean(pool.waitingRoomId)
  const { entryToken } = useWaitingRoomEntry()
  const token = requiresEntry ? entryToken : null
  const map = useSeatFeed(pool.id, { api, entryToken: token, sse })
  const hold = useSeatHold(pool.id, { api, feed: map.feed, requiresEntry, entryToken: token })
  const remainingMs = useRemainingMs(
    hold.hold?.status === 'HELD' ? hold.hold.expiresAt : null,
    map.feed.serverNow,
  )
  const expired = remainingMs !== null && remainingMs <= 0
  // 보류 시간이 끝나면 서버에 다시 묻는다 - 풀렸으면 보류를 비워 배치도가 다시 열린다(자리 0개 보류도 막히지 않는다)
  const { load } = hold.controller
  useEffect(() => {
    if (expired) void load()
  }, [expired, load])
  const entryMissing = requiresEntry && !token
  const confirmed = hold.hold?.status === 'CONFIRMED'
  return (
    <div className={styles.layout}>
      <div className={styles.map}>
        {entryMissing && <Alert tone="warning">{labels.map.entryMissing}</Alert>}
        <SeatMap
          seats={map.seats}
          loaded={map.loaded}
          connection={map.connection}
          mineIds={hold.hold?.seats.map((seat) => seat.id)}
          pendingIds={hold.pending}
          disabled={hold.locked || expired || confirmed || entryMissing}
          currency={pool.currency}
          locale={locale}
          onPick={(id) => void hold.controller.pick(id)}
          labels={labels}
        />
      </div>
      <HoldPanel
        hold={hold}
        remainingMs={remainingMs}
        currency={pool.currency}
        locale={locale}
        onCheckout={() => void hold.controller.checkout()}
        onConfirm={() => void hold.controller.confirm()}
        onLeave={() => void hold.controller.release()}
        onDismissProblem={hold.controller.dismissProblem}
        renderPayment={
          renderPayment
            ? (context) => renderPayment({ ...context, onPaid: () => void hold.controller.load() })
            : undefined
        }
        labels={labels}
      />
    </div>
  )
}
