import { formatInstant } from '@skeleton/time'
import { Badge, Button, Table, type TableColumn } from '@skeleton/ui'
import { useEffect, useState } from 'react'
import { lookup } from '../format'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import { ListFrame } from './ListFrame'
import sharedStyles from './shared.module.css'
import { isLimitMarker, isOrderResourceId, ORDER_RESOURCE_PREFIX } from './webhookMarker'
import type { WebhookEvent, WebhookEventStatus } from './types'

export type WebhookEventTableProps = {
  events: readonly WebhookEvent[]
  /**
   * 손이 필요한 줄(`FAILED` · `DEAD`, 그리고 받은 지 오래된 `RECEIVED`)의 「다시 처리」. 주지 않으면 단추가 없다.
   * 서버의 다시 처리는 누를 때마다 작업 하나(= 결제사 조회 하나)를 넣는다 - `IGNORED` · `PROCESSED` 줄은 다시 해도 화면이 안 바뀌고 갓 받은 `RECEIVED` 줄은 이미 작업이 걸려 있어서, 그 줄들에 단추를 두면 연타를 부른다
   */
  onRetryEvent?: (event: WebhookEvent) => void
  /** 다시 처리를 보내는 중인 줄의 id — 그 줄의 단추만 잠기고 스피너 */
  retryingId?: WebhookEvent['id']
  /**
   * 다시 처리가 **성공한** 줄 → 누른 시각(ms) - 부모가 `onRetryEvent` 의 성공마다 `{ [id]: 누른 시각 }` 을 더한다(시각은 `now` 와 같은 시계로).
   * 그 줄은 누른 뒤 `staleReceivedAfterMs` 동안 단추가 감춰지고 「다시 넣었어요」 상태 글자가 선다. **목록이 다시 읽혀도 비우지 않는다** -
   * 다시 넣은 줄은 `RECEIVED` 가 되지만 `receivedAt` 은 그대로라서, 비우면 작업이 도는 중에 단추가 곧바로 다시 나온다. 그 시간이 지나면 줄이 말하는 대로(아직 손이 필요하면 단추) 돌아간다
   */
  retried?: Readonly<Record<WebhookEvent['id'], number>>
  /**
   * `RECEIVED` 줄이 이만큼(ms) 넘게 머물면 작업이 죽었을 수 있다고 보고 단추를 둔다. 기본 10분. 다시 넣은 줄(`retried`)을 감추는 시간이기도 하다.
   * 백엔드의 `skeleton.payment.webhook.per-order-limit.window`(기본 10분) **이상**이어야 한다 - 그보다 짧으면 창 끝의 조회를 기다리는 표식 줄의 정상 대기에 단추가 겹친다
   */
  staleReceivedAfterMs?: number
  /**
   * 지금(ms) - 줄이 얼마나 머물렀는지 잴 기준. **서버의 시계**(응답의 `Date` 헤더 등)를 넘기는 것이 좋다 - 기기 시계가 틀리면 `receivedAt`(서버가 적은 시각)과의 차이가 어긋난다.
   * 넘기면 1분마다 하던 자동 갱신이 꺼진다(값이 바뀌는 것은 부모의 몫). 안 넘기면 기기 시계를 마운트 때 읽고 1분마다 갱신한다. 시험 · 스토리가 고정할 때도 쓴다
   */
  now?: number
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  onLoadMore?: () => void
  loadingMore?: boolean
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

const TONE: Record<WebhookEventStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  RECEIVED: 'info',
  PROCESSED: 'success',
  IGNORED: 'neutral',
  FAILED: 'warning',
  DEAD: 'danger',
}
/** `RECEIVED` 줄이 이만큼 넘게 머물면 작업이 죽었을 수 있다 - 단추를 둔다(기본 10분) */
export const STALE_RECEIVED_MS = 10 * 60_000

/** 손이 필요한 줄 - 처리가 안 됐거나(`FAILED`) 못 한(`DEAD`) 줄 */
const NEEDS_A_HAND: ReadonlySet<string> = new Set<WebhookEventStatus>(['FAILED', 'DEAD'])
/** 표식 줄이 이 상태면 창 끝의 조회 한 번이 끝났다 */
const MARKER_DONE: ReadonlySet<string> = new Set<WebhookEventStatus>(['PROCESSED', 'IGNORED'])

/** 지금(ms) - 고정값이 없으면 마운트 때 읽고 1분마다 갱신한다(화면을 열어 둔 채로 줄이 10분을 넘기면 단추가 생긴다) */
function useClock(fixed: number | undefined): number {
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    if (fixed !== undefined) return
    const timer = setInterval(() => setClock(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [fixed])
  return fixed ?? clock
}

/** 다시 넣은 줄을 감추는 동안인가 - 누른 뒤 `quietMs` 가 안 지났다. 시계가 거꾸로 가도(누른 시각이 `now` 보다 뒤) 감춘다 */
const isQuiet = (pressedAt: number | undefined, now: number, quietMs: number): boolean =>
  pressedAt !== undefined && now - pressedAt <= quietMs

/**
 * 이 줄에 「다시 처리」 단추를 둘까. 서버의 `retry` 는 `RECEIVED` · `IGNORED` · `FAILED` · `DEAD` 와 표식 줄을 모두 받지만(계약 3) 누를 때마다 작업을 하나 넣는다 -
 * 화면은 손이 필요한 줄(`FAILED` · `DEAD`)과, 받은 지 오래된 `RECEIVED`(작업이 죽었을 수 있다)에만 단추를 둔다. `IGNORED` · `PROCESSED` 는 없다
 */
function needsRetry(event: WebhookEvent, now: number, staleAfterMs: number): boolean {
  if (NEEDS_A_HAND.has(event.status)) return true
  if (event.status !== 'RECEIVED') return false
  const received = Date.parse(event.receivedAt)
  return Number.isFinite(received) && now - received > staleAfterMs
}

/**
 * 웹훅 수신함 — 결제사가 보낸 것을 받은 사실과 처리 결과(본문은 없다). 이벤트 이름 · 결제사 결제 번호 · 우리 이유 코드는 점검용이라
 * 있는 그대로 코드 모양으로 보이고, 상태만 글자로 푼다. 표식 줄(서버가 만든 줄)은 이벤트 이름 자리에 한 문장(기다리는 중 · 확인이 끝남 · 다시 시도하는 중 · 손이 필요함).
 * 손이 필요한 줄(`FAILED` · `DEAD`, 받은 지 오래된 `RECEIVED`)에만 테두리 단추 「다시 처리」 - 보낸 줄은 응답이 올 때까지 일하는 중, 성공하면 「다시 넣었어요」 상태 글자.
 */
export function WebhookEventTable({
  events,
  onRetryEvent,
  retryingId,
  retried: retriedAt,
  staleReceivedAfterMs = STALE_RECEIVED_MS,
  now: fixedNow,
  loading,
  error,
  onRetry,
  onLoadMore,
  loadingMore,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: WebhookEventTableProps) {
  const labels = resolvePaymentLabels(input)
  const text = labels.admin.webhooks
  const now = useClock(fixedNow)
  const eventName = (event: WebhookEvent) =>
    isLimitMarker(event)
      ? MARKER_DONE.has(event.status)
        ? text.limitMarker.done
        : event.status === 'DEAD'
          ? text.limitMarker.failed
          : event.status === 'FAILED'
            ? text.limitMarker.retrying
            : text.limitMarker.waiting
      : event.eventType

  const columns: TableColumn<WebhookEvent>[] = [
    {
      key: 'receivedAt',
      header: text.columns.receivedAt,
      rowHeader: true,
      render: (event) => formatTime(event.receivedAt),
    },
    {
      key: 'event',
      header: text.columns.event,
      render: (event) =>
        isLimitMarker(event) ? (
          eventName(event)
        ) : (
          <span className={sharedStyles.code}>{event.eventType}</span>
        ),
    },
    {
      key: 'resource',
      header: text.columns.resource,
      render: (event) =>
        isOrderResourceId(event.resourceId) ? (
          text.noProviderPayment(
            event.orderId ?? event.resourceId.slice(ORDER_RESOURCE_PREFIX.length),
          )
        ) : (
          <span className={sharedStyles.code}>{event.resourceId}</span>
        ),
    },
    {
      key: 'order',
      header: text.columns.order,
      render: (event) =>
        event.orderId ? <span className={sharedStyles.code}>{event.orderId}</span> : null,
    },
    {
      key: 'status',
      header: text.columns.status,
      render: (event) => (
        <span className={sharedStyles.cell}>
          <span>
            <Badge tone={lookup(TONE, event.status) ?? 'neutral'}>
              {lookup(labels.admin.webhookStatus, event.status) ?? labels.unknownStatus}
            </Badge>
          </span>
          {event.lastError && (
            <span className={sharedStyles.muted}>
              {text.columns.reason}: <span className={sharedStyles.code}>{event.lastError}</span>
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'deliveries',
      header: text.columns.deliveries,
      align: 'end',
      render: (event) => event.deliveries,
    },
    {
      key: 'actions',
      header: <span className={sharedStyles.srOnly}>{text.retry}</span>,
      render: (event) => {
        if (!onRetryEvent || !needsRetry(event, now, staleReceivedAfterMs)) return null
        // 시도를 다 쓴 `DEAD` 는 감추는 시간 안에도 손이 필요하다 - 단추를 보인다
        if (event.status !== 'DEAD' && isQuiet(retriedAt?.[event.id], now, staleReceivedAfterMs))
          return (
            <span role="status" className={sharedStyles.muted}>
              {text.retried}
            </span>
          )
        return (
          <Button
            variant="secondary"
            size="sm"
            aria-label={
              retryingId === event.id
                ? undefined
                : text.retryFor(
                    isLimitMarker(event) ? text.limitMarker.name : event.eventType,
                    event.orderId ?? event.resourceId,
                  )
            }
            loading={retryingId === event.id}
            loadingLabel={text.retrying}
            onClick={() => onRetryEvent(event)}
          >
            {text.retry}
          </Button>
        )
      },
    },
  ]

  return (
    <ListFrame
      hasRows={events.length > 0}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onLoadMore={onLoadMore}
      loadingMore={loadingMore}
      empty={{ title: text.emptyTitle, description: text.emptyDescription }}
      labels={labels}
    >
      <Table
        caption={text.caption}
        columns={columns}
        rows={events}
        rowKey={(event) => String(event.id)}
      />
    </ListFrame>
  )
}
