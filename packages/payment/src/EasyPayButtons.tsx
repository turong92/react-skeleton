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
  labels?: PaymentLabelsInput
}

/** 카드 단추(앱의 주된 결제 단추) 옆에 두는 간편결제 단추들 - 테두리 있는 단추 하나씩, 이름은 결제사가 부르는 이름이다. 단건 결제 전용(자동결제 등록 창엔 간편결제가 없다) */
export function EasyPayButtons({
  codes,
  onPick,
  disabled = false,
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
          onClick={() => onPick(code)}
        >
          {labels.easyPay.names[code]}
        </Button>
      ))}
    </div>
  )
}
