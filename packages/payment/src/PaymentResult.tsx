import { formatInstant } from '@skeleton/time'
import { Button, ErrorReference, Spinner } from '@skeleton/ui'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { confirmOutcomeOf } from './errors'
import { declineCategoryOf, referenceOf } from './failure'
import { cardDisplay, formatMoney } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { Order } from './ledgerTypes'
import { TestModeNotice } from './TestModeNotice'
import styles from './PaymentResult.module.css'

type Stage =
  | 'paid'
  | 'refunded'
  | 'confirming'
  | 'slow'
  | 'failed'
  | 'unconfirmed'
  | 'expired'
  | 'canceled'

/** 「확인이 늦어지고 있어요」로 바꾸기까지의 기본 시간(밀리초). 되묻기 간격은 최대 10초(`ORDER_POLL_MAX_MS`) */
export const DEFAULT_SLOW_AFTER_MS = 30_000

export type PaymentResultProps = {
  /** 아직 모르면(불러오는 중) 비운다 — 「결제 확인 중」으로 본다 */
  order?: Order | null
  /**
   * 승인 호출(`useConfirmOrder`)의 오류 — 끝내 오류로 끝났을 때만 준다(다시 보내는 동안은 `pending` 이라 오류가 없다). 서버가 읽어 준 `order` 가 끝 상태면 그것이 이긴다.
   * 아직 끝나지 않은 주문이면: `402 DECLINED` → 「결제 안 됨」, 그 밖의 확정 4xx(400 · 409 · 404) → 「결제를 확인하지 못했어요」, 결과를 모르는 오류 → 「확인이 늦어지고 있어요」
   */
  error?: unknown
  /** 주문을 아직 모를 때 테스트 결제 표시를 켜려면(주문이 있으면 그 `testMode`) */
  testMode?: boolean
  /** 「확인 중」이 이 시간(밀리초) 넘게 이어지면 「확인이 늦어지고 있어요」로 바꾼다. 스토리 · 시험에서는 0 이나 짧게 */
  slowAfterMs?: number
  /** 「결제 내역」 단추 — 결제됨 · 늦어지는 중에는 주 단추, 안 됐을 때는 보조 단추 */
  onViewHistory?: () => void
  /** 「다시 해 보기」 — 안 됐거나 시간이 지났거나 그만뒀을 때의 주 단추 */
  onRetry?: () => void
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

/**
 * 단계는 서버가 읽어 준 주문 상태에서 정해진다 — 끝 상태(`PAID` · `FAILED` · `EXPIRED` · `CANCELED` …)와 `CONFIRMING` 은 승인 호출의 오류보다 앞선다.
 * 아직 끝나지 않은(`PENDING` · 아직 못 읽은) 주문에서만 승인 호출의 오류가 말한다:
 * - 오류 없음 → 「확인 중」(`slowAfterMs` 뒤 「늦어지고 있어요」)
 * - 확정 거절(402 `DECLINED`) → 「결제 안 됨」 + 「다시 해 보기」
 * - 그 밖의 확정 4xx(400 · 409 · 404) → 「결제를 확인하지 못했어요」 — 스피너도 「다시 해 보기」도 없다(다시 누르면 새 주문이라 두 번 결제될 수 있다)
 * - 결과를 모르는 오류(`useConfirmOrder` 가 다시 보내 보고도 끝내 모른 채 — 네트워크 · 시간 초과 · 5xx · 401) → 「확인이 늦어지고 있어요」, 역시 「다시 해 보기」 없음
 */
function stageOf(order: Order | null | undefined, slow: boolean, error: unknown): Stage {
  switch (order?.status) {
    case 'PAID':
    case 'PARTIALLY_REFUNDED':
      return 'paid'
    case 'REFUNDED':
      return 'refunded'
    case 'FAILED':
      return 'failed'
    case 'EXPIRED':
      return 'expired'
    case 'CANCELED':
      return 'canceled'
    case 'CONFIRMING':
      return slow ? 'slow' : 'confirming'
    default: // PENDING · 아직 모름
      if (error === undefined || error === null) return slow ? 'slow' : 'confirming'
      switch (confirmOutcomeOf(error)) {
        case 'declined':
          return 'failed'
        case 'rejected':
          return 'unconfirmed'
        default:
          return 'slow'
      }
  }
}

/**
 * 결제 결과 — 됐어요 / 확인 중 / 늦어지고 있어요 / 안 됐어요 / 시간이 지났어요 / 그만뒀어요.
 * 「확인 중」은 끝없이 돌지 않는다: `slowAfterMs` 뒤에 「결제 내역」 단추와 함께 바뀐다(사용자가 갇히지 않는다).
 * 안 됐을 때의 문구는 거절의 종류로 고르고, 결제사 코드는 `ErrorReference` 안에만 둔다. `orderName` 은 그대로 보인다(상품을 모른다).
 */
export function PaymentResult({
  order,
  error,
  testMode,
  slowAfterMs = DEFAULT_SLOW_AFTER_MS,
  onViewHistory,
  onRetry,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: PaymentResultProps) {
  const labels = resolvePaymentLabels(input)
  const [slow, setSlow] = useState(slowAfterMs <= 0)
  // 다른 결제로 바뀌면(props 의 order.id) 「늦어지고 있어요」도 처음부터 다시 — 이전 결제의 기다림을 이어받지 않는다.
  // 주문을 아직 몰랐다가(`undefined`) 읽어 온 때는 바뀐 것이 아니다(기다린 시간이 이어진다)
  const [watching, setWatching] = useState(order?.id)
  if (order?.id !== undefined && order.id !== watching) {
    setWatching(order.id)
    if (watching !== undefined) setSlow(slowAfterMs <= 0)
  }
  const stage = stageOf(order, slow, error)
  const waiting = stage === 'confirming'

  useEffect(() => {
    if (!waiting || !Number.isFinite(slowAfterMs)) return
    const timer = setTimeout(() => setSlow(true), slowAfterMs)
    return () => clearTimeout(timer)
  }, [waiting, slowAfterMs, watching])

  // 결과가 바뀌면(확인 중 → 결제됨 …) 제목으로 포커스를 옮겨 낭독시킨다. 처음 그릴 때는 건드리지 않는다
  const titleRef = useRef<HTMLHeadingElement>(null)
  const lastStage = useRef(stage)
  useEffect(() => {
    if (lastStage.current !== stage) titleRef.current?.focus()
    lastStage.current = stage
  }, [stage])

  const titleId = useId()
  const descriptionId = useId()
  const money = order
    ? formatMoney(order.amount, { locale, currencySuffix: labels.currencySuffix })
    : null
  const card = order ? cardDisplay(order, labels) : null
  const reference =
    stage === 'failed' || stage === 'unconfirmed'
      ? referenceOf(error, order?.failureCode)
      : undefined

  const copy: Record<Stage, { title: string; description: string }> = {
    paid: labels.result.paid,
    refunded: labels.result.refunded,
    confirming: labels.result.confirming,
    slow: labels.result.slow,
    failed: {
      title: labels.result.failed.title,
      description: labels.failure[declineCategoryOf(error)],
    },
    unconfirmed: labels.result.unconfirmed,
    expired: labels.result.expired,
    canceled: labels.result.canceled,
  }
  const { title, description } = copy[stage]
  const paidDetails = stage === 'paid' || stage === 'refunded'
  const ended = stage === 'failed' || stage === 'expired' || stage === 'canceled' // 다시 해 볼 수 있는 끝
  const historyButton = (variant: 'primary' | 'secondary'): ReactNode =>
    onViewHistory && (
      <Button variant={variant} onClick={onViewHistory}>
        {labels.result.viewHistory}
      </Button>
    )

  return (
    <section className={styles.result} aria-labelledby={titleId} data-stage={stage}>
      {(order?.testMode ?? testMode) && <TestModeNotice labels={input} />}
      {/* 낭독은 한 길로: 확인 중에는 스피너가, 단계가 바뀌면 제목으로 옮긴 포커스가(제목 → 설명) 읽는다. 겹쳐 읽히지 않게 이 덩어리에는 live 역할을 주지 않는다 */}
      <div className={styles.message}>
        {waiting && <Spinner label={labels.result.confirming.loading} />}
        <h2
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          className={styles.title}
          aria-describedby={descriptionId}
        >
          {title}
        </h2>
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      </div>
      {order && (
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>{labels.summary.name}</dt>
            <dd>{order.orderName}</dd>
          </div>
          <div className={styles.fact}>
            <dt>{labels.summary.amount}</dt>
            <dd>{money}</dd>
          </div>
          {paidDetails && card && (
            <div className={styles.fact}>
              <dt>{labels.summary.method}</dt>
              <dd>{card}</dd>
            </div>
          )}
          {paidDetails && order.paidAt && (
            <div className={styles.fact}>
              <dt>{labels.summary.paidAt}</dt>
              <dd>{formatTime(order.paidAt)}</dd>
            </div>
          )}
        </dl>
      )}
      {reference && (
        <ErrorReference
          reference={reference}
          label={labels.reference.label}
          copyLabel={labels.reference.copy}
          copiedLabel={labels.reference.copied}
        />
      )}
      <div className={styles.actions}>
        {(stage === 'paid' ||
          stage === 'refunded' ||
          stage === 'slow' ||
          stage === 'unconfirmed') &&
          historyButton('primary')}
        {ended && onRetry && (
          <Button variant="primary" onClick={onRetry}>
            {labels.result.retry}
          </Button>
        )}
        {ended && historyButton(onRetry ? 'secondary' : 'primary')}
      </div>
    </section>
  )
}
