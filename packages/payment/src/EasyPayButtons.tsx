import { Button } from '@skeleton/ui'
import { EASY_PAY_CODES, type EasyPayCode } from './easyPay'
import { resolvePaymentLabels, type PaymentLabelsInput } from './labels'
import styles from './EasyPayButtons.module.css'

export type EasyPayButtonsProps = {
  /** `easyPaysFor(config, provider)` - 비면 아무것도 그리지 않는다 */
  codes: readonly string[]
  /** 누른 간편결제 - 앱이 주문을 만들고 `openCheckout(checkout, { easyPay })` 로 연다 */
  onPick: (code: EasyPayCode) => void
  /** 결제창을 여는 중이면 모두 막는다 */
  disabled?: boolean
  /** 막힌 화면(결제를 쓸 수 없음 · 요청이 많음) - `disabled` 대신 `aria-disabled` 로 포커스를 남기고 누름을 무시한다. 이유 글의 id 는 `describedBy` */
  ariaDisabled?: boolean
  describedBy?: string
  /** 창을 여는 중인 코드 - 그 단추에만 스피너(`loadingLabel` 이 낭독 이름) */
  loadingCode?: string | null
  loadingLabel?: string
  labels?: PaymentLabelsInput
}

/** 카드 단추(앱의 주된 결제 단추) 옆에 두는 간편결제 단추들 - 테두리 있는 단추 하나씩, 이름은 결제사가 부르는 이름이다. 단건 결제 전용(자동결제 등록 창엔 간편결제가 없다) */
export function EasyPayButtons({
  codes,
  onPick,
  disabled = false,
  ariaDisabled = false,
  describedBy,
  loadingCode = null,
  loadingLabel,
  labels: input,
}: EasyPayButtonsProps) {
  const labels = resolvePaymentLabels(input)
  const shown = codes.filter((code): code is EasyPayCode =>
    (EASY_PAY_CODES as readonly string[]).includes(code),
  )
  if (shown.length === 0) return null
  return (
    <div role="group" aria-label={labels.easyPay.group} className={styles.group}>
      {shown.map((code) => (
        <Button
          key={code}
          variant="secondary"
          size="lg"
          disabled={disabled}
          loading={loadingCode === code}
          {...(loadingLabel ? { loadingLabel } : {})}
          aria-disabled={ariaDisabled ? true : undefined}
          aria-describedby={ariaDisabled ? describedBy : undefined}
          onClick={ariaDisabled ? undefined : () => onPick(code)}
        >
          {labels.easyPay.names[code]}
        </Button>
      ))}
    </div>
  )
}
