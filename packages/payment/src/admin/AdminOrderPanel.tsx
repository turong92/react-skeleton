import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { formatInstant } from '@skeleton/time'
import { Alert, Badge, Button, Card, ErrorReference } from '@skeleton/ui'
import { useId } from 'react'
import { isPaymentLedgerError, PaymentLedgerErrorCodes } from '../errors'
import { referenceOf } from '../failure'
import { adminMethodDisplay, formatMoney, lookup, requestedAmountNote } from '../format'
import { resolvePaymentLabels, type PaymentLabels, type PaymentLabelsInput } from '../labels'
import type { OpenRefundStatus, Refund } from '../ledgerTypes'
import { OrderStatusBadge, RefundStatusBadge } from '../OrderStatusBadge'
import { TestModeNotice } from '../TestModeNotice'
import styles from './AdminOrderPanel.module.css'
import { closedByOf } from './closedBy'
import { isErasedAccount } from './erasedAccount'
import { PaymentEventList } from './PaymentEventList'
import { isMoneyOffReason, isRetryJobReason } from './reviewReason'
import type { AdminOrder, AdminOrderDetail, AdminRefund } from './types'

export type AdminOrderPanelProps = {
  detail: AdminOrderDetail
  /** 주면 환불할 수 있는 결제에 「환불하기」가 생긴다(전액 · 부분). 확인 창(`AdminRefundDialog`)을 여는 것은 부모 */
  onRefund?: () => void
  /** 주면 기다리는 요청(`REQUESTED`) 줄 옆에 「요청대로 환불하기」가 생긴다 — 돈이 나가니 부모가 확인 창을 연다 */
  onApprove?: (refund: AdminRefund) => void
  /** 주면 기다리는 요청 줄 옆에 「요청 거절하기」가 생긴다 */
  onReject?: (refund: AdminRefund) => void
  /** 주면 「결제사와 맞추기」가 생긴다 */
  onSync?: () => void
  /**
   * 주면 결제사가 답하지 않아 오래 확인 중(`CONFIRMING` + `CONFIRM_UNRESOLVED` · `STALE_CONFIRMING`)으로 남은 **구독 결제**에 「결제 안 됨으로 닫기」가 생긴다(돈이 나가지 않는 단추 - 서버가 닫기 전에 결제사에 한 번 더 묻는다).
   * 확인 창(`CloseSubscriptionChargeDialog`)을 여는 것은 부모
   */
  onCloseCharge?: () => void
  /**
   * 화면이 낡았을 수 있다(다시 읽기가 실패했다). 돈이 나가는 단추(「환불하기」 · 「요청대로 환불하기」)가 `aria-disabled` 로 막히고 이유가 설명으로 붙는다 -
   * 방금 환불이 나갔는데 화면이 환불 전 그대로면 같은 환불이 한 번 더 나갈 수 있다. 「요청 거절하기」 · 「결제사와 맞추기」(돈이 안 나간다)는 그대로다
   * (주문의 `reviewReason` 이 돈이 어긋난 사유 - `REFUND_MISMATCH` · `AMOUNT_MISMATCH` · `ORDER_MISMATCH` · `MODE_MISMATCH` - 일 때도 같은 두 단추가 「먼저 결제사와 맞춰 주세요」로 막힌다.
   * 이 넷 중 **서버가 환불을 `REFUND_NOT_ALLOWED` 409 로 막는 것은 `REFUND_MISMATCH`** 이고, `MODE_MISMATCH` 는 모드가 실제로 다르면 서버가 `PAYMENT.MODE_MISMATCH` 409 로도 막는다. 나머지는 맞추기를 먼저 권하는 것이다 - 그래서 `onSync` 가 없으면 `REFUND_MISMATCH` 만 막고,
   * 문구도 없는 단추로 보내지 않는 「결제사와 어긋나 있어 환불할 수 없어요」다. 맞춘 뒤(`synced`)에도 사유가 남았으면 「맞춰 봤지만 아직 어긋나 있어요 …」다)
   */
  stale?: boolean
  /**
   * 방금 환불 · 승인 호출이 돌려준 줄(`SUCCEEDED` · `PENDING`) - 「환불했어요: 금액」 · 「환불 중이에요: 금액」을 상태 글자로 말한다.
   * **`stale` 인 동안에만** 말한다(다시 읽기가 실패해 아래 목록이 낡았을 때 - 방금 한 일이 목록에 안 보일 수 있다). 다시 읽기가 성공하면 환불 줄이 사실을 말하고,
   * 변경의 답은 그 뒤에도 남으니 말하지 않는다. 낡은 목록에서도 줄 id 로 찾아지고 그 줄이 답보다 더 간 상태면 그 줄이 말한다(답 `PENDING` 이 목록에서 `SUCCEEDED` 로 보이면 「환불했어요」, `FAILED` 로 보이면 말하지 않는다) -
   * 못 찾거나 덜 간 상태(아직 `REQUESTED`)일 때만 답을 쓴다. 두 호출이 있으면 더 최근 것을 부모가 고른다
   */
  refunded?: Pick<Refund, 'id' | 'status' | 'amount'>
  /** 맞추는 중 — 단추가 잠기고 스피너 */
  syncing?: boolean
  /**
   * 방금 맞추기가 돌려준 주문(`useSyncOrder` 의 `data`) - 「결제사와 맞췄어요」를 낭독 가능한 상태 글자로, 사유가 남았으면 「맞춰 봤지만 …」로 말한다.
   * **맞춘 응답의 `reviewReason` 이 지금 화면의 사유와 같을 때만** 말한다 - 맞춘 뒤에 새로 생긴 사유(맞추기 → 직접 환불 → `REFUND_MISMATCH`)에는 아무도 묻지 않았으니
   * 「맞춰 봤지만」이 거짓이고, 그 사유의 출구는 사람이 누르는 맞추기다. 환불 · 승인 · 거절을 **보내는 순간**(`onSend`)과, 사유가 이 응답의 `reviewReason` 과 달라지는 순간에 부모가 `sync.reset()` 으로 비운다 - 한 번 갈라지면 되살아나지 않아야 한다(맞춤 → 풀림 → 같은 사유로 다시 찍혀도 거짓 「맞춰 봤지만」이 뜨지 않게)
   */
  synced?: Pick<AdminOrder, 'reviewReason'>
  /**
   * 맞추기는 됐는데 직접 환불의 모름(잠금 · 든 키)을 못 놓았다 - 보낸 지 얼마 안 돼 그 환불이 아직 가는 중일 수 있다. `heldSecondsOf(direct.forget())` 의 값 - 있으면(`null` 이 아니면) 말한다. 초는 문장에 쓰지 않는다(누른 순간의 값이라 줄지 않는다).
   * 주면 「결제사와 맞췄어요」 옆에 「보낸 환불이 아직 가는 중일 수 있어요 …」를 낭독 가능한 상태 글자로 말한다(맞춘 응답이 지금 사유와 맞을 때만)
   */
  syncHeld?: number | null
  /** 맞추기가 실패한 오류 — 이유를 글자로, 참조 번호와 함께 */
  syncError?: unknown
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

/** 환불 줄이 걸어온 만큼 - 기다림(`REQUESTED`) → 나가는 중(`PENDING`) → 끝남. 낡은 목록의 줄이 변경의 답보다 덜 간 것이면 답이 더 최근이다 */
const progress = (line: Pick<Refund, 'status'>) =>
  line.status === 'REQUESTED' ? 0 : line.status === 'PENDING' ? 1 : 2

const REFUNDABLE = new Set(['PAID', 'PARTIALLY_REFUNDED'])
const OPEN_REFUND = new Set(['REQUESTED', 'PENDING'])

function syncErrorMessage(error: unknown, labels: PaymentLabels): string {
  const text = labels.admin.panel.syncErrors
  if (isPaymentLedgerError(error, PaymentLedgerErrorCodes.CAPABILITY_UNSUPPORTED))
    return text.unsupported
  // 결제사가 그 결제를 모른다 - 다시 건 일이 없고 다시 눌러도 같다
  if (isPaymentLedgerError(error, PaymentLedgerErrorCodes.PROVIDER_PAYMENT_NOT_FOUND))
    return text.providerNotFound
  // 이 결제를 만든 키의 쪽(테스트 · 실제 결제)이 지금과 다르다 - 다시 해도 안 되니 「다시 해 보세요」로 끝내지 않는다
  if (isPaymentLedgerError(error, PaymentLedgerErrorCodes.MODE_MISMATCH)) return text.modeMismatch
  if (
    isPaymentLedgerError(error, PaymentLedgerErrorCodes.UNAVAILABLE) ||
    isErrorCode(error, ErrorCodes.PAYMENT_PROVIDER_ERROR)
  )
    return text.unavailable
  return text.other
}

/**
 * 운영자의 결제 한 건 — 이름 · 상태 · 결제 번호 · 계정 · 결제사와 그 결제 번호 · 금액 · 카드 표시 · 시각, 확인 필요면 이유와 다음 걸음,
 * 환불 줄(기다리는 요청 옆에 결정 단추), 이력, 그리고 「환불하기」(직접) · 「결제사와 맞추기」.
 * **채운 단추는 화면에 하나뿐**이다 — 상태마다 가장 중요한 행동 하나만 채우고 나머지는 테두리 단추다. 우선순위:
 * ① 기다리는 요청이 있으면 그 결정(첫 요청의 「요청대로 환불하기」 — 승인 핸들러가 있을 때, **막혀 있지 않을 때**(`stale` · 돈이 어긋남) - 막힌 단추를 채우지 않는다) ② 확인 필요면 「결제사와 맞추기」
 * ③ 누를 수 있는 「환불하기」 ④ 「결제사와 맞추기」(환불이 막혔거나 없을 때) ⑤ 막힌 「환불하기」(눌러 볼 다른 것이 없을 때, 흐리게).
 * 「요청 거절하기」는 늘 테두리 단추다. `stale`(화면이 낡았을 수 있음)이거나 돈이 결제사와 어긋난 확인 필요(`isMoneyOffReason`)면 돈이 나가는 두 단추도 같은 방식으로 막힌다. 못 누르는 「환불하기」(요청이 열려 있음 · 환불 중)는
 * `aria-disabled` 로 흐리게 두고 이유를 옆에 글자로 적는다 — Tab 으로 닿고 이유가 단추 설명으로 낭독되며, 눌러도 아무 일도 없다.
 */
export function AdminOrderPanel({
  detail,
  onRefund,
  onApprove,
  onReject,
  onSync,
  onCloseCharge,
  stale,
  refunded,
  syncing,
  synced,
  syncHeld,
  syncError,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: AdminOrderPanelProps) {
  const labels = resolvePaymentLabels(input)
  const text = labels.admin
  const { order, refunds, events } = detail
  const reasonId = useId()
  const holdId = useId()
  const money = (amount: number) =>
    formatMoney(
      { amount, currency: order.amount.currency },
      { locale, currencySuffix: labels.currencySuffix },
    )
  const card = adminMethodDisplay(order, labels)

  // 열린 환불의 상태: 환불 줄이 말해 주면 그것이, 아니면 주문 응답이
  const openLine = refunds.find((refund) => OPEN_REFUND.has(refund.status))
  const open: OpenRefundStatus | null =
    (openLine?.status as OpenRefundStatus | undefined) ?? order.openRefundStatus
  const canCloseCharge =
    Boolean(onCloseCharge) &&
    order.status === 'CONFIRMING' &&
    order.kind.startsWith('SUBSCRIPTION_') &&
    // 막 나간 승인은 결제사가 아직 모를 뿐이다 - 서버도 같은 조건으로만 닫는다
    (order.reviewReason === 'CONFIRM_UNRESOLVED' || order.reviewReason === 'STALE_CONFIRMING')
  const canRefund = Boolean(onRefund) && REFUNDABLE.has(order.status) && order.refundableAmount > 0
  const review = order.reviewReason
  // 맞춘 응답이 지금 화면의 사유와 같을 때만 「맞춘 뒤」다 - 다른 사유는 맞춘 뒤에 새로 생긴 것이다
  const syncedNow = synced != null && (synced.reviewReason ?? null) === (review ?? null)
  // 돈이 나가는 두 단추(「환불하기」 · 「요청대로 환불하기」)를 막는 이유 - 낡은 화면(방금 나간 환불이 안 보일 수 있다)이거나, 돈이 결제사와 어긋났다.
  // 맞추기 단추가 있으면 넷 모두 먼저 맞추기를 권한다(맞춘 뒤에도 남았으면 그렇게 말한다). 없으면 서버가 실제로 막는 `REFUND_MISMATCH` 만 막고 없는 단추로 보내지 않는다
  const moneyOff = onSync ? isMoneyOffReason(review) : review === 'REFUND_MISMATCH'
  // 서버가 이 결제사로는 환불을 못 보낸다고 알렸다 - 돈이 나가는 두 단추를 막고 이유를 적는다(거절은 그대로)
  const providerBlock = order.refundBlock
    ? (lookup(text.refundBlock, order.refundBlock) ?? text.refundBlock.OTHER)
    : null
  const hold = providerBlock
    ? providerBlock
    : stale
      ? text.panel.stale
      : moneyOff
        ? onSync
          ? syncedNow
            ? text.panel.stillOff
            : text.panel.syncFirst
          : text.panel.moneyOff
        : null
  const blocked =
    open === 'REQUESTED'
      ? text.panel.refundBlockedByRequest
      : open === 'PENDING'
        ? labels.refundBlocked.inProgress
        : hold
  // 막은 이유는 한 번만 그린다 - 「환불하기」가 이유로 쓰면 그 자리, 아니면 결정 단추가 있는 환불 줄 위
  const holdOnRefund = hold !== null && canRefund && blocked === hold
  const hasDecisions = Boolean(onApprove) && refunds.some((refund) => refund.status === 'REQUESTED')
  const holdOnDecisions = hold !== null && hasDecisions && !holdOnRefund
  // 방금 한 일 - 낡은 화면에서만. 줄 id 로 목록에서 찾아지고 그 줄이 답보다 더 간 상태면 그 줄이, 아니면 답이 말한다
  const listed = stale && refunded ? refunds.find((line) => line.id === refunded.id) : undefined
  const done =
    stale && refunded
      ? listed && progress(listed) >= progress(refunded)
        ? listed
        : refunded
      : null
  const doneLine = done?.status === 'SUCCEEDED' || done?.status === 'PENDING' ? done : null
  // 채운 단추 하나 — 위 JSDoc 의 우선순위. 낡은 화면이면 요청대로 환불하기는 막혀 있으니 채움 후보가 아니다(막힌 단추를 채우지 않는다)
  const approvable =
    onApprove && hold === null ? refunds.find((refund) => refund.status === 'REQUESTED') : undefined
  const main: 'approve' | 'sync' | 'refund' | null = approvable
    ? 'approve'
    : review && onSync
      ? 'sync'
      : canRefund && blocked === null
        ? 'refund'
        : onSync
          ? 'sync'
          : canRefund
            ? 'refund'
            : null

  return (
    <Card
      title={order.orderName}
      actions={
        <span className={styles.flags}>
          <OrderStatusBadge status={order.status} openRefundStatus={open} labels={input} />
          {review && <Badge tone="warning">{labels.unknownStatus}</Badge>}
        </span>
      }
    >
      <div className={styles.body}>
        {order.testMode && <TestModeNotice labels={input} />}
        {review && (
          <Alert tone="warning" toneLabel={labels.noticeLabel} title={labels.unknownStatus}>
            <span>{lookup(text.reviewReason, review) ?? text.reviewUnknown}</span>
            {onSync && (
              <p className={styles.muted}>
                {/* 맞춘 뒤에도 사유가 남았다(오래 남은 것으로 파생된 사유는 맞춰도 안 풀릴 수 있다) - 「누르면 …」을 되풀이하지 않고 지금 사실을 말한다 */}
                {syncedNow && !syncError
                  ? isRetryJobReason(review)
                    ? text.reviewHintRetrySynced
                    : text.reviewHintSynced
                  : isRetryJobReason(review)
                    ? text.reviewHintRetry
                    : text.reviewHint}
              </p>
            )}
          </Alert>
        )}
        <dl className={styles.facts}>
          <Fact label={text.panel.id}>
            <span className={styles.code}>{order.id}</span>
          </Fact>
          {order.accountId && (
            <Fact label={text.panel.account}>
              <span className={styles.code}>{order.accountId}</span>
              {isErasedAccount(order) && (
                <>
                  {' '}
                  <Badge tone="neutral">{text.erasedAccount}</Badge>
                </>
              )}
            </Fact>
          )}
          <Fact label={text.panel.provider}>{order.provider}</Fact>
          {order.providerPaymentId && (
            <Fact label={text.panel.providerPayment}>
              <span className={styles.code}>{order.providerPaymentId}</span>
            </Fact>
          )}
          <Fact label={labels.summary.amount}>{money(order.amount.amount)}</Fact>
          {card && <Fact label={labels.summary.method}>{card}</Fact>}
          {order.paidAt && <Fact label={labels.summary.paidAt}>{formatTime(order.paidAt)}</Fact>}
          {order.refundedAmount > 0 && (
            <Fact label={labels.summary.refunded}>{money(order.refundedAmount)}</Fact>
          )}
          {order.refundableAmount > 0 && REFUNDABLE.has(order.status) && (
            <Fact label={labels.summary.refundable}>{money(order.refundableAmount)}</Fact>
          )}
        </dl>
        {doneLine && (
          <p role="status" className={styles.done}>
            {(doneLine.status === 'PENDING' ? text.panel.refunding : text.panel.refunded)(
              money(doneLine.amount.amount),
            )}
          </p>
        )}
        {order.failureCode && (
          <ErrorReference
            reference={order.failureCode}
            label={text.panel.failureCode}
            copyLabel={labels.reference.copy}
            copiedLabel={labels.reference.copied}
          />
        )}
        {(canRefund || onSync || canCloseCharge) && (
          <div className={styles.action}>
            {canRefund && (
              <Button
                variant={main === 'refund' ? 'primary' : 'secondary'}
                aria-disabled={blocked !== null ? true : undefined}
                aria-describedby={blocked ? (holdOnRefund ? holdId : reasonId) : undefined}
                onClick={blocked !== null ? undefined : onRefund}
              >
                {text.panel.refund}
              </Button>
            )}
            {canRefund && blocked && (
              <span id={holdOnRefund ? holdId : reasonId} className={styles.reason}>
                {blocked}
              </span>
            )}
            {onSync && (
              <Button
                variant={main === 'sync' ? 'primary' : 'secondary'}
                loading={syncing}
                loadingLabel={text.panel.syncing}
                onClick={onSync}
              >
                {text.panel.sync}
              </Button>
            )}
            {canCloseCharge && (
              <Button variant="secondary" onClick={onCloseCharge}>
                {text.panel.closeCharge}
              </Button>
            )}
            {syncedNow && !syncError && (
              <span role="status" className={styles.reason}>
                {text.panel.synced}
              </span>
            )}
            {syncedNow && !syncError && syncHeld != null && (
              <span role="status" className={styles.reason}>
                {text.panel.syncHeld}
              </span>
            )}
          </div>
        )}
        {Boolean(syncError) && (
          <>
            <Alert tone="danger" toneLabel={labels.errorLabel}>
              {syncErrorMessage(syncError, labels)}
            </Alert>
            {referenceOf(syncError) && (
              <ErrorReference
                reference={referenceOf(syncError)}
                label={labels.reference.label}
                copyLabel={labels.reference.copy}
                copiedLabel={labels.reference.copied}
              />
            )}
          </>
        )}
        {refunds.length > 0 && (
          <section aria-label={labels.summary.refunds}>
            <h3 className={styles.heading}>{labels.summary.refunds}</h3>
            {holdOnDecisions && (
              <p id={holdId} className={styles.reason}>
                {hold}
              </p>
            )}
            <ul className={styles.refunds}>
              {refunds.map((refund) => {
                const reason = lookup(labels.refundReason, refund.reasonCode)
                const amount = money(refund.amount.amount)
                const requestedNote = requestedAmountNote(refund, labels, locale)
                return (
                  <li key={refund.id} className={styles.refund}>
                    <RefundStatusBadge
                      status={refund.status}
                      closedBy={closedByOf(refund)}
                      labels={input}
                    />
                    <strong>{amount}</strong>
                    {requestedNote && <span className={styles.muted}>{requestedNote}</span>}
                    <span className={styles.muted}>
                      {formatTime(refund.completedAt ?? refund.requestedAt)} ·{' '}
                      {lookup(text.actors, refund.origin) ?? ''}
                      {reason && ` · ${reason}`}
                    </span>
                    {refund.failureCode &&
                      (lookup(text.refundFailure, refund.failureCode) ? (
                        // 우리 쪽 코드는 문장으로 - 조용히(`SUCCEEDED` 줄에 `RESULT_MISMATCH` 가 남을 수 있다)
                        <span className={styles.muted}>
                          {lookup(text.refundFailure, refund.failureCode)}
                        </span>
                      ) : (
                        <ErrorReference
                          reference={refund.failureCode}
                          label={text.panel.failureCode}
                          copyLabel={labels.reference.copy}
                          copiedLabel={labels.reference.copied}
                        />
                      ))}
                    {refund.status === 'REQUESTED' && (onApprove || onReject) && (
                      <span className={styles.decide}>
                        {onApprove && (
                          <Button
                            variant={refund === approvable ? 'primary' : 'secondary'}
                            size="sm"
                            aria-label={text.panel.approveFor(amount, refund.orderId)}
                            aria-disabled={hold !== null ? true : undefined}
                            aria-describedby={hold !== null ? holdId : undefined}
                            onClick={hold !== null ? undefined : () => onApprove(refund)}
                          >
                            {text.panel.approve}
                          </Button>
                        )}
                        {onReject && (
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label={text.panel.rejectFor(amount, refund.orderId)}
                            onClick={() => onReject(refund)}
                          >
                            {text.panel.reject}
                          </Button>
                        )}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        <section aria-label={text.panel.events}>
          <h3 className={styles.heading}>{text.panel.events}</h3>
          <PaymentEventList events={events} labels={labels} formatTime={formatTime} />
        </section>
      </div>
    </Card>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
