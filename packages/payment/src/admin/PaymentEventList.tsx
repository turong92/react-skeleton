import { ErrorReference } from '@skeleton/ui'
import { lookup } from '../format'
import type { PaymentLabels } from '../labelTypes'
import styles from './AdminOrderPanel.module.css'
import type { PaymentEvent } from './types'

/** 이력 한 줄의 상태 바뀜 — 환불 줄의 일이면 환불 상태 낱말로, 아니면 결제 상태 낱말로 읽는다(`PENDING` 이 양쪽에 있다). 모르는 상태가 끼면 코드를 그리지 않고 비운다 */
function statusChange(event: PaymentEvent, labels: PaymentLabels): string | null {
  if (!event.fromStatus || !event.toStatus || event.fromStatus === event.toStatus) return null
  const tables = event.refundId
    ? [labels.refundStatus, labels.orderStatus]
    : [labels.orderStatus, labels.refundStatus]
  const read = (code: string) => tables.map((table) => lookup(table, code)).find(Boolean)
  const from = read(event.fromStatus)
  const to = read(event.toStatus)
  return from && to ? `${from} → ${to}` : null
}

export type PaymentEventListProps = {
  events: readonly PaymentEvent[]
  labels: PaymentLabels
  formatTime: (iso: string) => string
}

/** 「이 결제가 왜 이 상태인가」 — **최신 것이 위**(서버는 오래된 것부터 준다; `id` 는 그 주문 안의 순번) 한 줄씩: 때 · 누가 · 무슨 일 · 상태 바뀜 · (있으면) 참조 번호 */
export function PaymentEventList({ events, labels, formatTime }: PaymentEventListProps) {
  const text = labels.admin
  if (events.length === 0) return <p className={styles.muted}>{text.panel.noEvents}</p>
  return (
    <ol className={styles.events}>
      {[...events]
        .sort((a, b) => b.id - a.id)
        .map((event) => {
          const change = statusChange(event, labels)
          // 이력에만 남는 우리 코드(`PROVIDER_PENDING_EXPIRED` · `LATE_RESULT`)는 문장으로 - 참조 번호에는 두지 않는다
          const coded = lookup(text.eventCodes, event.providerCode)
          // `LATE_RESULT` 는 이력 종류가 `REFUND_UNKNOWN` 이라 이름만 읽으면 「결과를 아직 몰라요」다 - 일어난 일이 그 이름을 대신한다
          const replacesTitle = coded !== undefined && event.type === 'REFUND_UNKNOWN'
          const reference = [
            coded ? null : event.providerCode,
            event.providerTraceId,
            event.traceId,
          ]
            .filter(Boolean)
            .join(' / ')
          return (
            <li key={event.id} className={styles.event}>
              <span className={styles.muted}>
                {formatTime(event.createdAt)} · {lookup(text.actors, event.actor) ?? ''}
              </span>
              <strong>
                {(replacesTitle ? coded : lookup(text.eventTypes, event.type)) ?? text.unknownEvent}
              </strong>
              {coded && !replacesTitle && <span className={styles.muted}>{coded}</span>}
              {change && <span className={styles.muted}>{change}</span>}
              {reference && (
                <ErrorReference
                  reference={reference}
                  label={labels.reference.label}
                  copyLabel={labels.reference.copy}
                  copiedLabel={labels.reference.copied}
                />
              )}
            </li>
          )
        })}
    </ol>
  )
}
