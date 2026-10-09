import { Alert, ConfirmDialog, ErrorReference, Field, Input, Select } from '@skeleton/ui'
import { useId, useState, type ReactNode } from 'react'
import { declineDetail, isPaymentLedgerError, PaymentLedgerErrorCodes } from '../errors'
import { referenceOf } from '../failure'
import { formatMoney, lookup } from '../format'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import type { Order, Refund } from '../ledgerTypes'
import { fractionDigits, minorToInput, parseAmountInput } from './amountInput'
import styles from './AdminRefundDialog.module.css'
import { RefundNotDoneError, refundProblemOf } from './refundOutcome'
import { rowActionClass } from './rowAction'
import type { OperatorRefundInput, OperatorRefundReason } from './types'

type Common = {
  open: boolean
  /** 닫기 · × · Esc — 열림 상태는 부모가 쥔다 */
  onClose: () => void
  /** 보내는 중 — 두 단추가 잠기고 확인에 스피너(이때만 진짜 `disabled`) */
  busy?: boolean
  /** 호출이 실패했을 때의 오류 — 알려진 환불 오류는 이유를, 그 밖은 일반 문구와 참조 번호를 보인다. 열 때마다 묵은 오류가 보이지 않게 부모가 `reset()` 한다 */
  error?: unknown
  locale?: string
  labels?: PaymentLabelsInput
}

/** 운영자가 금액(전액 · 부분)과 사유를 정해 바로 환불한다 — 금액은 남은 금액을 넘지 못한다(화면에서도 막는다, 서버가 최종 판단) */
type Direct = {
  mode: 'direct'
  /** `openRefundStatus` 는 선택 - 있으면 409 `REFUND_IN_PROGRESS` 가 「환불 중」인지 「기다리는 요청」인지 가른다 */
  order: Pick<Order, 'amount' | 'refundableAmount'> & Partial<Pick<Order, 'openRefundStatus'>>
  onConfirm: (input: OperatorRefundInput & { amount: number }) => void
  /**
   * 마지막으로 **보낸** 금액 · 사유(부모의 변경이 쥔 변수) - 잠긴 칸(보내는 중 · 결과를 모름)은 적던 글자가 아니라 이 값을 보인다.
   * 주지 않으면 칸의 글자를 그대로 보인다
   */
  sent?: { amount: number; reasonCode: OperatorRefundReason }
}

/** 본인의 환불 요청 하나를 승인(`approve` — 요청한 금액 그대로 환불한다)하거나 거절(`reject` — 돈은 안 나간다)한다 */
type Decide = {
  mode: 'approve' | 'reject'
  request: Pick<Refund, 'orderId' | 'amount' | 'reasonCode'>
  /** 알면 준다 — 요청이 남은 금액보다 크면 화면에서도 막는다 */
  order?: Pick<Order, 'refundableAmount'>
  onConfirm: () => void
  /**
   * 이 요청의 결제 한 건으로 가는 링크(목록에서 연 창이 준다 — 한 건 화면에서는 필요 없다). 승인이 끝내 정해지지 않았거나(결과를 모름 · 이미 처리됨)
   * 요청이 환불 안 됨으로 닫혔을 때만 오류 아래에 보인다 — 거기서 환불 내역을 보거나 직접 환불한다.
   * 창이 **버튼 모양 클래스**를 건넨다(날 `<a>` 는 밑줄도 테두리도 없는 글자로 그려지니 링크의 `className` 에 꼭 붙인다) - 라우터의 `<Link className={className} …>`.
   */
  orderLink?: (buttonLikeClassName: string) => ReactNode
}

export type AdminRefundDialogProps = Common & (Direct | Decide)

const REASONS: readonly OperatorRefundReason[] = [
  'OPERATOR',
  'CUSTOMER_REQUEST',
  'DUPLICATE',
  'NOT_DELIVERED',
]

/**
 * 운영자의 환불 결정 창 — 돈이 나가는 행동(직접 환불 · 요청대로 환불)은 늘 이 창을 거친다. 처음 포커스는 — 직접 환불은 금액 칸(Enter 로 제출되지 않는다), 요청 처리는 「닫기」(실수로 Enter 를 눌러도 안전).
 * 못 누르는 확인(남은 금액 없음 · 금액이 잘못됨 · 서버가 「환불 중」 「지금은 안 됨」이라고 답함)은 꺼지지 않고 `aria-disabled` 로 흐리게 남아
 * Tab 으로 닿고, 이유 문장이 단추 설명으로 낭독된다. 거절 창은 돈이 안 나가므로 보통 단추 색.
 * 서버의 답은 **확정과 모름을 가른다**(`refundProblemOf`): 답을 잃었으면 「결과를 확인하지 못했어요」(확인은 열려 있다), 요청 승인이 결제사에 거절되면 그 요청이 닫혔다고
 * 말하고 확인을 막는다. 요청 처리 창은 어느 결제인지(결제 번호)를 한 줄로 말한다.
 * **보내는 중과 결과를 모르는 동안**(직접 환불)에는 금액 · 사유 칸이 잠긴다(읽기 전용이되 닿고, 이유 한 줄이 두 칸의 설명이다) - 모르는 동안은 같은 내용으로만 다시 보낼 수 있다.
 * 키는 의도(주문 · 사유 · 금액)별이라 다른 값을 보내면 새 키이고, 첫 시도가 이미 나갔다면 두 번째 환불이 나간다. 잠긴 칸은 적던 글자가 아니라 **보낸 값**(`sent`)을 보인다.
 * 일하는 중에 × 로 닫았다 다시 열어도, 모름으로 끝난 뒤 다시 열어도, 닫아 둔 창이 확정 오류로 다시 열려도 처음 모습으로 돌아가지 않는다(보낸 값이 그대로 보인다) -
 * 처음 모습(전액 · 운영자 사유)으로 돌아오는 것은 열 때 오류가 남아 있지 않을 때뿐이다.
 */
export function AdminRefundDialog(props: AdminRefundDialogProps) {
  const { open, onClose, busy, error, locale, labels: input } = props
  const labels = resolvePaymentLabels(input)
  const text = labels.admin.refundDialog
  const direct = props.mode === 'direct'
  const money = props.mode === 'direct' ? props.order.amount : props.request.amount
  const refundable =
    props.mode === 'direct' ? props.order.refundableAmount : props.order?.refundableAmount
  const digits = fractionDigits(money.currency)
  const show = (minor: number) =>
    formatMoney(
      { amount: minor, currency: money.currency },
      { locale, currencySuffix: labels.currencySuffix },
    )

  const fieldId = useId()
  const reasonId = useId()
  const lockedId = useId()
  const fullAmount = minorToInput(refundable ?? 0, digits)

  // 서버의 답 — 확정(서버가 요청을 보고 답했다)과 모름(답을 잃었다)을 가른다. 모름을 「못 했어요」라고 단정하지 않는다
  const hasError = error !== undefined && error !== null
  const answer = hasError ? refundProblemOf(error) : null
  // 결과를 모르는 직접 환불 - 보낸 값을 바꾸면 새 키라 이미 나간 환불이 한 번 더 나갈 수 있다. 두 칸을 잠그고 처음 모습으로 돌아가지도 않는다
  const locked = direct && answer === 'unknown'
  // 보내는 중에도 두 칸은 읽기 전용이다 - 보내는 동안 고친 값은 보내지 않은 값이라, 모름으로 끝났을 때 「잠긴 값」이 되면 안 된다
  const frozen = locked || (direct && Boolean(busy))

  const [reason, setReason] = useState<OperatorRefundReason>('OPERATOR')
  const [draft, setDraft] = useState(fullAmount)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    // 열 때마다 처음 모습(전액 · 운영자 사유)으로 돌아온다 - 일하는 중이거나 끝난 오류(확정이든 모름이든)가 남아 있으면 보낸 값이 그대로여야 한다
    // (새로 여는 길은 부모가 오류를 먼저 지운다 - 오류가 남아 있는데 여는 것은 닫아 둔 창이 오류로 다시 열리는 경우다)
    if (open && !busy && !hasError) {
      setReason('OPERATOR')
      setDraft(fullAmount)
    }
  }

  // 창에 보이는 값 = 보낸 값 - 잠긴 칸(보내는 중 · 결과를 모름)은 적던 글자가 아니라 부모가 쥔 **보낸 변수**를 보인다(없으면 칸의 글자)
  const sent = props.mode === 'direct' && frozen ? props.sent : undefined
  const shownAmount = sent ? minorToInput(sent.amount, digits) : draft
  const shownReason = sent ? sent.reasonCode : reason

  // 금액 — 직접 환불은 적은 글자를 읽어 검사하고, 요청 처리는 요청한 금액 그대로
  const parsed = parseAmountInput(shownAmount, digits)
  const nothingToRefund = direct && refundable !== undefined && refundable <= 0
  let problem: string | null = null
  if (direct && !nothingToRefund) {
    if (parsed.kind === 'empty') problem = text.blocked.empty
    else if (parsed.kind === 'invalid') problem = text.blocked.invalid
    else if (parsed.minor <= 0) problem = text.blocked.zero
    else if (refundable !== undefined && parsed.minor > refundable)
      problem = text.blocked.exceeds(show(refundable))
  }
  const tooBig =
    props.mode === 'approve' && refundable !== undefined && props.request.amount.amount > refundable
  const overMessage =
    tooBig && refundable !== undefined ? text.blocked.exceeds(show(refundable)) : null

  const doneAs = error instanceof RefundNotDoneError ? error.refund.status : null
  const approving = props.mode === 'approve'
  const rejecting = props.mode === 'reject'
  // 승인이 결제사 거절(402)이면 그 요청 줄은 환불 안 됨으로 닫혔다(스펙 §5.3 — FAILED → PENDING 전이는 없다)
  const requestClosed = approving && answer === 'declined'
  // 승인이 2xx 인데 답 줄이 FAILED 다(같은 키 재전송의 답 · 늦은 결과) - 닫혔다는 건 같지만 「거절돼서」가 아니다. 결제사가 환불했는지는 환불 내역이 말한다
  const approveClosedLine = approving && answer === 'notDone' && doneAs === 'FAILED'
  // 승인의 409 는 두 뜻이다(요청이 이미 결정됐다 / 주문이 환불할 수 없거나 결제사에 결제가 없다) - 어느 쪽인지 모르니 중립으로 말하고 한 건으로 보낸다
  const approveRefused = approving && answer === 'notAllowed'
  // 이 결제를 만든 키의 쪽(테스트 · 실제 결제)이 지금과 다르다(409 `MODE_MISMATCH`) - 직접 환불 · 승인 모두 다시 해도 안 된다
  const modeMismatch =
    !rejecting && isPaymentLedgerError(error, PaymentLedgerErrorCodes.MODE_MISMATCH)
  // 요청이 이미 결정됐다(다른 운영자 · 본인이 거둠 · 답을 잃었던 첫 승인이 나갔음)
  const alreadyDecided =
    !direct &&
    !approveRefused &&
    (answer === 'notAllowed' || (answer === 'notDone' && !approveClosedLine))
  // 같은 것을 다시 보내도 소용없는 답 — 확인이 막힌다(닿되 `aria-disabled`, 창을 다시 열면 풀린다)
  const serverBlocked = rejecting
    ? alreadyDecided
    : answer === 'inProgress' ||
      answer === 'amountExceeded' ||
      (direct && answer === 'notAllowed') ||
      requestClosed ||
      approveClosedLine ||
      approveRefused ||
      alreadyDecided
  let message: string
  if (rejecting)
    message = alreadyDecided
      ? text.errors.alreadyDecided
      : answer === 'unknown'
        ? text.reject.unknown
        : text.reject.error
  else if (requestClosed) message = text.errors.requestClosed
  else if (modeMismatch) message = text.errors.modeMismatch
  else if (approveClosedLine) message = text.errors.notDone
  else if (approveRefused) message = text.errors.approveNotAllowed
  else if (alreadyDecided) message = text.errors.alreadyDecided
  else if (answer === 'inProgress')
    message =
      props.mode === 'direct' && props.order.openRefundStatus === 'REQUESTED'
        ? text.errors.requestWaiting
        : labels.refundBlocked.inProgress
  else if (answer === 'notAllowed') message = text.errors.notAllowed
  else if (answer === 'amountExceeded')
    message = approving ? text.errors.approveExceeded : text.errors.amountExceeded
  else if (answer === 'declined')
    message =
      lookup(text.errors.declined, declineDetail(error)?.category) ?? text.errors.declined.OTHER
  else if (answer === 'unavailable') message = text.errors.unavailable
  else if (answer === 'invalid') message = text.errors.invalid
  else if (answer === 'notDone') message = text.errors.notDone
  else if (answer === 'unknown') message = text.errors.unknown
  else message = text.errors.other
  const reference = hasError ? referenceOf(error) : undefined
  // 결제 한 건으로 가는 길 — 요청을 다시 보내도 소용없거나(닫힘 · 이미 처리됨 · 지금은 안 됨 · 금액이 큼) 결과를 몰라서 환불 내역을 봐야 할 때
  const showOrderLink =
    approving &&
    (requestClosed ||
      approveClosedLine ||
      alreadyDecided ||
      approveRefused ||
      answer === 'amountExceeded' ||
      answer === 'unknown')

  const fieldErrorId = `${fieldId}-error`
  const describedBy = (existing?: string) =>
    [existing, frozen ? lockedId : null].filter(Boolean).join(' ') || undefined
  const blockedBy = nothingToRefund
    ? reasonId
    : problem
      ? fieldErrorId
      : overMessage || serverBlocked
        ? reasonId
        : undefined
  const copy =
    props.mode === 'direct' ? text.direct : props.mode === 'approve' ? text.approve : text.reject

  function confirm() {
    if (props.mode !== 'direct') return props.onConfirm()
    if (parsed.kind === 'ok') props.onConfirm({ reasonCode: shownReason, amount: parsed.minor })
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      title={copy.title}
      confirmLabel={rejecting ? text.reject.confirm : text.confirm}
      cancelLabel={text.dismiss}
      closeLabel={text.close}
      loadingLabel={rejecting ? text.reject.loading : text.loading}
      tone={rejecting ? 'primary' : 'danger'}
      busy={busy}
      confirmBlockedBy={blockedBy}
      description={
        <div className={styles.body}>
          {props.mode === 'direct' ? (
            <>
              <Field
                id={fieldId}
                label={text.amountLabel}
                hint={refundable !== undefined ? text.amountHint(show(refundable)) : undefined}
                error={problem ?? undefined}
              >
                {(control) => (
                  <Input
                    {...control}
                    aria-describedby={describedBy(control['aria-describedby'])}
                    value={shownAmount}
                    readOnly={frozen}
                    inputMode={digits === 0 ? 'numeric' : 'decimal'}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                )}
              </Field>
              <Field label={text.reason}>
                {(control) =>
                  frozen ? (
                    // 고를 수 있는 목록 대신 보낸 사유를 읽기 전용으로 - 닿고, 같은 이유 한 줄이 설명이다
                    <Input
                      {...control}
                      aria-describedby={describedBy(control['aria-describedby'])}
                      value={lookup(labels.refundReason, shownReason) ?? shownReason}
                      readOnly
                    />
                  ) : (
                    <Select
                      {...control}
                      value={reason}
                      onChange={(event) => setReason(event.target.value as OperatorRefundReason)}
                    >
                      {REASONS.map((code) => (
                        <option key={code} value={code}>
                          {labels.refundReason[code]}
                        </option>
                      ))}
                    </Select>
                  )
                }
              </Field>
              {frozen && (
                <p id={lockedId} className={styles.note}>
                  {locked ? text.locked : text.sending}
                </p>
              )}
            </>
          ) : (
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>{labels.admin.panel.id}</dt>
                <dd className={`${styles.factValue} ${styles.codeValue}`}>
                  {props.request.orderId}
                </dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>{text.requestedAmount}</dt>
                <dd className={`${styles.factValue} ${styles.amountValue}`}>
                  {show(props.request.amount.amount)}
                </dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>{text.reason}</dt>
                <dd className={styles.factValue}>
                  {lookup(labels.refundReason, props.request.reasonCode) ?? ''}
                </dd>
              </div>
            </dl>
          )}
          <p className={styles.note}>{copy.note}</p>
          {nothingToRefund && (
            <div id={reasonId}>
              <Alert tone="info" toneLabel={labels.noticeLabel}>
                {labels.refundDialog.nothingToRefund}
              </Alert>
            </div>
          )}
          {overMessage && !nothingToRefund && (
            <div id={reasonId}>
              <Alert tone="warning" toneLabel={labels.noticeLabel}>
                {overMessage}
              </Alert>
            </div>
          )}
          {hasError && (
            <>
              <div
                id={
                  !nothingToRefund && !overMessage && !problem && serverBlocked
                    ? reasonId
                    : undefined
                }
              >
                <Alert tone="danger" toneLabel={labels.errorLabel}>
                  {message}
                </Alert>
              </div>
              {reference && (
                <ErrorReference
                  reference={reference}
                  label={labels.reference.label}
                  copyLabel={labels.reference.copy}
                  copiedLabel={labels.reference.copied}
                />
              )}
              {showOrderLink && props.mode === 'approve' && props.orderLink?.(rowActionClass)}
            </>
          )}
        </div>
      }
    />
  )
}
