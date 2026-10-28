import { ConfirmDialog } from '@skeleton/ui'
import { formatMoney } from '../format'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import type { AdminCatalogPrice } from './catalogAdminTypes'
import { CatalogErrorNotice } from './CatalogErrorNotice'
import styles from './StopPriceDialog.module.css'

export type StopPriceDialogProps = {
  open: boolean
  /** 닫기 · × · Esc - 열림 상태는 부모가 쥔다 */
  onClose: () => void
  /** 「판매 중지」 - 호출과 닫는 것은 부모 */
  onConfirm: () => void
  price: Pick<AdminCatalogPrice, 'code' | 'amount' | 'currency'>
  busy?: boolean
  /** 중지가 실패했을 때의 오류 - 열 때마다 묵은 오류가 보이지 않게 부모가 `reset()` 한다 */
  error?: unknown
  locale?: string
  labels?: PaymentLabelsInput
}

/**
 * 가격의 판매를 멈추는 확인 창. 가격 줄은 고치지 않는다 - 멈추면 새로 사는 사람에게만 사라지고 기존 구독자는 이 가격 그대로라는 것을 본문이 먼저 말한다.
 * 처음 포커스는 「닫기」(실수로 Enter 를 눌러도 안전).
 */
export function StopPriceDialog({
  open,
  onClose,
  onConfirm,
  price,
  busy,
  error,
  locale,
  labels: input,
}: StopPriceDialogProps) {
  const all = resolvePaymentLabels(input)
  const text = all.admin.catalog.stopDialog
  const money = formatMoney(price, { locale, currencySuffix: all.currencySuffix })
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={text.title}
      confirmLabel={text.confirm}
      cancelLabel={text.dismiss}
      closeLabel={text.close}
      loadingLabel={text.loading}
      busy={busy}
      description={
        <div className={styles.body}>
          <p className={styles.which}>{text.which(price.code, money)}</p>
          <p className={styles.text}>{text.body}</p>
          <CatalogErrorNotice error={error} labels={input} />
        </div>
      }
    />
  )
}
