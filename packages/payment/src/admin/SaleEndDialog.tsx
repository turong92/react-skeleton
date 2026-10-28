import { Button, Dialog, Field, Input } from '@skeleton/ui'
import { useId, useState } from 'react'
import { formatMoney } from '../format'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import type { AdminCatalogPrice } from './catalogAdminTypes'
import { CatalogErrorNotice } from './CatalogErrorNotice'
import { toLocalInput, validateSaleEnd } from './saleEnd'
import styles from './AddPriceDialog.module.css'

export type SaleEndDialogProps = {
  open: boolean
  onClose: () => void
  /** 「바꾸기」 - 호출과 닫는 것은 부모. `null` 은 끝 없음. 틀린 값이면 부르지 않는다 */
  onSubmit: (saleEndsAt: string | null) => void
  price: Pick<AdminCatalogPrice, 'code' | 'amount' | 'currency' | 'saleStartsAt' | 'saleEndsAt'>
  busy?: boolean
  /** 실패했을 때의 오류 - 열 때마다 묵은 오류가 보이지 않게 부모가 `reset()` 한다 */
  error?: unknown
  locale?: string
  labels?: PaymentLabelsInput
}

/** 행사가의 끝나는 시각만 바꾸는 창(가격 줄은 고치지 않는다 - 행사 기간만 예외). 비우면 끝 없이 이어진다 */
export function SaleEndDialog({
  open,
  onClose,
  onSubmit,
  price,
  busy,
  error,
  locale,
  labels: input,
}: SaleEndDialogProps) {
  const all = resolvePaymentLabels(input)
  const text = all.admin.catalog.saleEndDialog
  const formId = useId()
  const [value, setValue] = useState(toLocalInput(price.saleEndsAt))
  const [problem, setProblem] = useState<'timeInvalid' | 'endBeforeStart' | 'endRequired' | null>(
    null,
  )
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && !busy && (error === undefined || error === null)) {
      setValue(toLocalInput(price.saleEndsAt))
      setProblem(null)
    }
  }
  const money = formatMoney(price, { locale, currencySuffix: all.currencySuffix })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={text.title}
      closeLabel={text.close}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {text.cancel}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={busy}
            loadingLabel={text.loading}
          >
            {text.submit}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (busy) return
          const result = validateSaleEnd(value, price.saleStartsAt)
          setProblem(result.problem)
          if (result.problem === null) onSubmit(result.value)
        }}
      >
        <p>{text.which(price.code, money)}</p>
        <Field
          label={text.end}
          hint={text.hint}
          error={
            problem === 'endRequired'
              ? text.endRequired
              : problem
                ? all.admin.catalog.addPrice.problems[problem]
                : undefined
          }
        >
          {(control) => (
            <Input
              {...control}
              type="datetime-local"
              value={value}
              disabled={busy}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </Field>
        <CatalogErrorNotice error={error} labels={input} />
      </form>
    </Dialog>
  )
}
