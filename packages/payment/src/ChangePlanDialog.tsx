import { Alert, ConfirmDialog, ErrorReference, Field, Select } from '@skeleton/ui'
import { useId } from 'react'
import { PaymentLedgerErrorCodes, isPaymentLedgerError } from './errors'
import { referenceOf } from './failure'
import { formatMoney, priceEveryDisplay } from './format'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import type { ChangePlanInput, PlanChangePreview, SubscriptionPlan } from './subscriptionTypes'
import styles from './ChangePlanDialog.module.css'

export type ChangePlanDialogProps = {
  open: boolean
  /** 닫기 · × · Esc - 열림 상태는 부모가 쥔다 */
  onClose: () => void
  /** 「플랜 바꾸기」 - **창이 보인 그 금액을 `expectedCharge` 로** 보낸다(그 사이 올랐으면 서버가 409 로 거절한다). 호출과 닫는 것은 부모 */
  onConfirm: (input: ChangePlanInput) => void
  /** 바꿀 수 있는 플랜 - 지금보다 윗등급만 부모가 걸러 넘긴다 */
  plans: readonly SubscriptionPlan[]
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
  labels?: PaymentLabelsInput
}

/**
 * 플랜 올리기 확인 창 - 플랜을 고르면 **지금 결제될 금액**(0 이면 「추가 결제 없이」)과 다음 결제부터의 가격을 미리 보이고, 「플랜 바꾸기」/「닫기」.
 * 금액을 읽기 전에는 확인이 잠긴다. 처음 포커스는 「닫기」.
 */
export function ChangePlanDialog({
  open,
  onClose,
  onConfirm,
  plans,
  planCode,
  onPlanChange,
  preview,
  previewLoading,
  previewError,
  busy,
  error,
  locale,
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

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => preview && onConfirm({ planCode, expectedCharge: preview.charge.amount })}
      title={labels.title}
      confirmLabel={labels.confirm}
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
                {plans.map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {`${plan.name} - ${priceEveryDisplay(plan.amount, plan.period, all, locale)}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {ready ? (
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt>{labels.chargeNow}</dt>
                <dd className={styles.charge}>{money(preview.charge)}</dd>
              </div>
              <div className={styles.fact}>
                <dt>{labels.nextPrice}</dt>
                <dd>{priceEveryDisplay(preview.amount, preview.period, all, locale)}</dd>
              </div>
            </dl>
          ) : (
            <p id={statusId} className={styles.note}>
              {previewError ? labels.previewError : labels.loadingPreview}
            </p>
          )}
          {ready && preview.charge.amount === 0 && <p className={styles.note}>{labels.noCharge}</p>}
          {ready && preview.restartsPeriod && <p className={styles.note}>{labels.restart}</p>}
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
