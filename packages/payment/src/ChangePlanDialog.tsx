import { Alert, ConfirmDialog, ErrorReference, Field, Select } from '@skeleton/ui'
import { useId } from 'react'
import { PaymentLedgerErrorCodes, isPaymentLedgerError } from './errors'
import { referenceOf } from './failure'
import { formatInstant } from '@skeleton/time'
import { formatMoney, priceEveryDisplay } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import { planChangeTiming, type CurrentTier } from './planChange'
import type {
  ChangePlanInput,
  PlanChangePreview,
  ScheduledChange,
  SubscriptionPlan,
} from './subscriptionTypes'
import styles from './ChangePlanDialog.module.css'

export type ChangePlanDialogProps = {
  open: boolean
  /** 닫기 · × · Esc - 열림 상태는 부모가 쥔다 */
  onClose: () => void
  /** 「플랜 바꾸기」 - **창이 보인 그 금액을 `expectedCharge` 로** 보낸다(그 사이 올랐으면 서버가 409 로 거절한다). 호출과 닫는 것은 부모 */
  onConfirm: (input: ChangePlanInput) => void
  /** 바꿀 수 있는 플랜 - 지금 플랜과 통화가 다른 것은 부모가 걸러 넘긴다(`changeChoices`). 등급이 낮은 플랜도 온다(예약) */
  plans: readonly SubscriptionPlan[]
  /**
   * 지금 구독의 등급 · 주기 · 통화 - 주면 선택지를 「바로 바꿔요」/「다음 결제일부터 바꿔요」로 묶는다. 안 주면 묶지 않는다(모두 바로).
   * 묶음은 짐작이고, 확인 창이 말하는 적용 시점은 서버 미리보기의 `timing` 이다
   */
  current?: CurrentTier
  /** 이미 예약된 변경이 있으면 준다 - 다른 변경을 고르면 그 예약이 사라지거나 덮인다고 한 줄 말한다 */
  scheduledChange?: Pick<ScheduledChange, 'planName' | 'effectiveAt'> | null
  /** 고른 플랜 코드 - 부모가 쥐고 이 코드로 미리보기를 묻는다 */
  planCode: string
  onPlanChange: (planCode: string) => void
  /** 고른 플랜의 미리보기 - 없으면(읽는 중 · 실패) 확인이 잠긴다 */
  preview?: PlanChangePreview | undefined
  previewLoading?: boolean
  previewError?: unknown
  /** 보내는 중 - 두 단추가 잠기고 확인에 스피너 */
  busy?: boolean
  /** 바꾸기가 실패했을 때의 오류 - 알려진 오류는 이유를, 그 밖은 일반 문구와 참조 번호를 보인다 */
  error?: unknown
  locale?: string
  formatTime?: (iso: string) => string
  labels?: PaymentLabelsInput
}

/**
 * 플랜 바꾸기 확인 창 - 플랜을 고르면 **지금 결제될 금액**(0 이면 「추가 결제 없이」)과 다음 결제부터의 가격을 미리 보이고, 「이 플랜으로 바꾸기」/「닫기」.
 * 내리기 · 주기 줄이기는 예약이다(서버 미리보기 `timing: 'NEXT_RENEWAL'`) - 결제 금액 대신 **바뀌는 날**을 보이고 확인은 「변경 예약」이 된다. 선택지는 `current` 를 주면 바로/다음 결제일부터로 묶인다.
 * 금액을 읽기 전에는 확인이 잠긴다. 처음 포커스는 「닫기」.
 */
export function ChangePlanDialog({
  open,
  onClose,
  onConfirm,
  plans,
  current,
  scheduledChange,
  planCode,
  onPlanChange,
  preview,
  previewLoading,
  previewError,
  busy,
  error,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  labels: input,
}: ChangePlanDialogProps) {
  const all = resolvePaymentLabels(input)
  const labels = all.subscription.changeDialog
  const statusId = useId()
  const ready = preview !== undefined && !previewLoading && preview.planCode === planCode
  const message = isPaymentLedgerError(error, PaymentLedgerErrorCodes.PLAN_CHANGE_CHARGE_CHANGED)
    ? labels.errors.chargeChanged
    : isPaymentLedgerError(error, PaymentLedgerErrorCodes.DECLINED)
      ? labels.errors.declined
      : isPaymentLedgerError(error, PaymentLedgerErrorCodes.PLAN_CHANGE_NOT_ALLOWED)
        ? labels.errors.notAllowed
        : labels.errors.other
  const reference = error ? referenceOf(error) : undefined
  const money = (amount: { amount: number; currency: string }) =>
    formatMoney(amount, { locale, currencySuffix: all.currencySuffix })
  const scheduled = ready && preview.timing === 'NEXT_RENEWAL'
  // 새 주기로 옮기면서 남은 몫을 깎아 주는 변경인가 - 서버 미리보기의 `credit`(없거나 0 이면 전액)
  const credit = ready && preview.credit && preview.credit.amount > 0 ? preview.credit : null
  const option = (plan: SubscriptionPlan) => (
    <option key={plan.code} value={plan.code}>
      {`${plan.name} - ${priceEveryDisplay(plan.amount, plan.period, all, locale)}`}
    </option>
  )
  const grouped = current
    ? {
        now: plans.filter((plan) => planChangeTiming(current, plan) !== 'NEXT_RENEWAL'),
        next: plans.filter((plan) => planChangeTiming(current, plan) === 'NEXT_RENEWAL'),
      }
    : null

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => preview && onConfirm({ planCode, expectedCharge: preview.charge.amount })}
      title={labels.title}
      confirmLabel={scheduled ? labels.confirmScheduled : labels.confirm}
      cancelLabel={labels.dismiss}
      closeLabel={labels.close}
      loadingLabel={labels.loading}
      tone="primary"
      busy={busy}
      confirmBlockedBy={ready ? undefined : statusId}
      description={
        <div className={styles.body}>
          <Field label={labels.plan}>
            {(control) => (
              <Select
                {...control}
                value={planCode}
                onChange={(event) => onPlanChange(event.target.value)}
              >
                {grouped ? (
                  <>
                    {grouped.now.length > 0 && (
                      <optgroup label={labels.groups.now}>{grouped.now.map(option)}</optgroup>
                    )}
                    {grouped.next.length > 0 && (
                      <optgroup label={labels.groups.next}>{grouped.next.map(option)}</optgroup>
                    )}
                  </>
                ) : (
                  plans.map(option)
                )}
              </Select>
            )}
          </Field>
          {ready ? (
            <dl className={styles.facts}>
              {scheduled ? (
                preview.effectiveAt && (
                  <div className={styles.fact}>
                    <dt>{labels.effectiveOn}</dt>
                    <dd className={styles.charge}>{formatTime(preview.effectiveAt)}</dd>
                  </div>
                )
              ) : (
                <div className={styles.fact}>
                  <dt>{labels.chargeNow}</dt>
                  <dd className={styles.charge}>{money(preview.charge)}</dd>
                </div>
              )}
              <div className={styles.fact}>
                <dt>{labels.nextPrice}</dt>
                <dd>{priceEveryDisplay(preview.amount, preview.period, all, locale)}</dd>
              </div>
            </dl>
          ) : (
            <p id={statusId} className={styles.note}>
              {previewError
                ? isPaymentLedgerError(
                    previewError,
                    PaymentLedgerErrorCodes.PLAN_CHANGE_NOT_ALLOWED,
                  )
                  ? labels.previewNotAllowed
                  : labels.previewError
                : labels.loadingPreview}
            </p>
          )}
          {scheduled && <p className={styles.note}>{labels.scheduledNote}</p>}
          {ready && !scheduled && preview.charge.amount === 0 && (
            <p className={styles.note}>{labels.noCharge}</p>
          )}
          {ready && !scheduled && preview.restartsPeriod && (
            <p className={styles.note}>
              {credit ? labels.restartCredit(money(credit), money(preview.charge)) : labels.restart}
            </p>
          )}
          {ready && scheduledChange && (
            <p className={styles.note}>
              {(scheduled ? labels.replacesSchedule : labels.clearsSchedule)(
                scheduledChange.planName,
                formatTime(scheduledChange.effectiveAt),
              )}
            </p>
          )}
          {error !== undefined && error !== null && (
            <>
              <Alert tone="danger" toneLabel={all.errorLabel}>
                {message}
              </Alert>
              {reference && (
                <ErrorReference
                  reference={reference}
                  label={all.reference.label}
                  copyLabel={all.reference.copy}
                  copiedLabel={all.reference.copied}
                />
              )}
            </>
          )}
        </div>
      }
    />
  )
}
