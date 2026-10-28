import { Button, Checkbox, Dialog, Field, Input, Select } from '@skeleton/ui'
import { useId, useState } from 'react'
import type { CatalogKind } from '../catalogTypes'
import { fractionDigits } from './amountInput'
import { resolvePaymentLabels, type PaymentLabelsInput } from '../labels'
import {
  currencyOf,
  EMPTY_ADD_PRICE_FORM,
  validateAddPrice,
  type AddPriceForm,
  type AddPriceProblems,
} from './addPriceForm'
import type { AddCatalogPriceInput, AdminCatalogPrice } from './catalogAdminTypes'
import { formatMoney } from '../format'
import { CatalogErrorNotice } from './CatalogErrorNotice'
import { fieldMessageOf } from './catalogErrors'
import styles from './AddPriceDialog.module.css'

/** 폼 칸 → 서버 요청 본문의 칸 이름(다른 것만) */
const SERVER_FIELD: Record<keyof AddPriceProblems, string> = {
  period: 'period',
  replaces: 'replaces',
  amount: 'amount',
  currency: 'currency',
  regularAmount: 'compareAtAmount',
  saleStartsAt: 'saleStartsAt',
  saleEndsAt: 'saleEndsAt',
  code: 'code',
}

export type AddPriceDialogProps = {
  open: boolean
  /** 닫기 · × · Esc - 열림 상태는 부모가 쥔다 */
  onClose: () => void
  /** 「가격 더하기」 - 호출과 닫는 것은 부모. 틀린 칸이 있으면 부르지 않는다 */
  onSubmit: (input: AddCatalogPriceInput) => void
  /** 구독 상품에만 주기 칸이 있다 */
  kind: CatalogKind
  /** 이 상품의 가격들 - 「이 가격을 대신함」에 같은 주기 · 통화의 판매 중 가격만 고를 수 있게 준다(없으면 고르기가 없다) */
  prices?: readonly AdminCatalogPrice[]
  locale?: string
  busy?: boolean
  /** 더하기가 실패했을 때의 오류 - 열 때마다 묵은 오류가 보이지 않게 부모가 `reset()` 한다 */
  error?: unknown
  labels?: PaymentLabelsInput
}

/**
 * 가격 더하기 창 - 주기(구독 상품만 · 월간 · 연간 · 직접) · 금액 · 통화(KRW · USD · 직접) · 선택 가격 코드, 「행사가로 팔기」를 켜면 정가 · 시작 · 끝.
 * 금액은 통화의 기본 단위로 적고(`9900` · `9.99`) 창이 최소 단위 정수로 바꿔 보낸다. 틀린 칸은 「가격 더하기」를 누를 때 칸 아래에서 이유를 말한다.
 * 열 때마다 처음 모습으로 돌아온다(오류가 남은 채 다시 열리는 경우는 쓰던 값을 둔다).
 */
export function AddPriceDialog({
  open,
  onClose,
  onSubmit,
  kind,
  prices = [],
  locale,
  busy,
  error,
  labels: input,
}: AddPriceDialogProps) {
  const all = resolvePaymentLabels(input)
  const text = all.admin.catalog.addPrice
  const formId = useId()
  const [form, setForm] = useState<AddPriceForm>(EMPTY_ADD_PRICE_FORM)
  const [problems, setProblems] = useState<AddPriceProblems>({})
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && !busy && (error === undefined || error === null)) {
      setForm(EMPTY_ADD_PRICE_FORM)
      setProblems({})
    }
  }
  const set = (patch: Partial<AddPriceForm>) => setForm((current) => ({ ...current, ...patch }))
  const say = (key: keyof AddPriceProblems) => {
    const problem = problems[key]
    if (problem === 'codeInvalid') return all.admin.catalog.editor.problems.codeInvalid
    return problem ? text.problems[problem] : fieldMessageOf(error, SERVER_FIELD[key])
  }
  const currency = currencyOf(form)
  const periodNow = form.period === 'custom' ? form.customPeriod.trim() : form.period
  // 대신할 수 있는 가격 - 같은 주기, 같은 통화에서 지금 판매 중인 것만. 행사가를 더할 때는 상시 가격(기간이 없는 것)을 뺀다 - 행사가는 상시 가격을 멈추지 않고 그 위에 얹힌다
  const replaceable = prices.filter(
    (price) =>
      price.selling &&
      price.stoppedAt === null &&
      (!form.sale || price.saleStartsAt !== null || price.saleEndsAt !== null) &&
      price.currency === currency &&
      (kind === 'ONE_TIME' ? price.period === null : price.period === periodNow),
  )
  const known = /^[A-Z]{3}$/.test(currency)
  const amountHint = text.amountHint(
    known ? currency : text.currency,
    fractionDigits(known ? currency : 'USD') === 0 ? '9900' : '9.99',
  )

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
          // 주기나 통화를 바꿔 더는 맞지 않는 옛 가격은 보내지 않는다
          const keep = replaceable.some((p) => p.code === form.replaces)
          const result = validateAddPrice({ ...form, replaces: keep ? form.replaces : '' }, kind)
          setProblems(result.problems ?? {})
          if (result.input) onSubmit(result.input)
        }}
      >
        {kind === 'SUBSCRIPTION' && (
          <>
            <Field label={text.period}>
              {(control) => (
                <Select
                  {...control}
                  value={form.period}
                  disabled={busy}
                  onChange={(event) => set({ period: event.target.value })}
                >
                  <option value="P1M">{text.periodMonthly}</option>
                  <option value="P1Y">{text.periodYearly}</option>
                  <option value="custom">{text.periodCustom}</option>
                </Select>
              )}
            </Field>
            {form.period === 'custom' && (
              <Field
                label={text.periodCustomLabel}
                hint={text.periodCustomHint}
                error={say('period')}
              >
                {(control) => (
                  <Input
                    {...control}
                    value={form.customPeriod}
                    disabled={busy}
                    onChange={(event) => set({ customPeriod: event.target.value })}
                  />
                )}
              </Field>
            )}
          </>
        )}
        <Field label={text.currency}>
          {(control) => (
            <Select
              {...control}
              value={form.currency}
              disabled={busy}
              onChange={(event) => set({ currency: event.target.value })}
            >
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
              <option value="custom">{text.currencyCustom}</option>
            </Select>
          )}
        </Field>
        {form.currency === 'custom' && (
          <Field
            label={text.currencyCustomLabel}
            hint={text.currencyCustomHint}
            error={say('currency')}
          >
            {(control) => (
              <Input
                {...control}
                value={form.customCurrency}
                maxLength={3}
                disabled={busy}
                onChange={(event) => set({ customCurrency: event.target.value })}
              />
            )}
          </Field>
        )}
        <Field label={text.amount} hint={amountHint} error={say('amount')} required>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={form.amount}
              disabled={busy}
              onChange={(event) => set({ amount: event.target.value })}
            />
          )}
        </Field>
        <Checkbox
          label={text.sale}
          description={text.saleHint}
          checked={form.sale}
          disabled={busy}
          onChange={(event) => set({ sale: event.target.checked })}
        />
        {form.sale && (
          <>
            <Field
              label={text.regularAmount}
              hint={text.regularAmountHint}
              error={say('regularAmount')}
              required
            >
              {(control) => (
                <Input
                  {...control}
                  inputMode="decimal"
                  value={form.regularAmount}
                  disabled={busy}
                  onChange={(event) => set({ regularAmount: event.target.value })}
                />
              )}
            </Field>
            <Field label={text.saleStarts} error={say('saleStartsAt')}>
              {(control) => (
                <Input
                  {...control}
                  type="datetime-local"
                  value={form.saleStartsAt}
                  disabled={busy}
                  onChange={(event) => set({ saleStartsAt: event.target.value })}
                />
              )}
            </Field>
            <Field label={text.saleEnds} hint={text.saleWindowHint} error={say('saleEndsAt')}>
              {(control) => (
                <Input
                  {...control}
                  type="datetime-local"
                  value={form.saleEndsAt}
                  disabled={busy}
                  onChange={(event) => set({ saleEndsAt: event.target.value })}
                />
              )}
            </Field>
          </>
        )}
        {replaceable.length > 0 && (
          <Field
            label={text.replaces}
            hint={form.replaces !== '' ? text.replacesHint(form.replaces) : undefined}
            error={say('replaces')}
          >
            {(control) => (
              <Select
                {...control}
                value={replaceable.some((p) => p.code === form.replaces) ? form.replaces : ''}
                disabled={busy}
                onChange={(event) => set({ replaces: event.target.value })}
              >
                <option value="">{text.replacesNone}</option>
                {replaceable.map((price) => (
                  <option key={price.code} value={price.code}>
                    {text.replacesOption(
                      price.code,
                      formatMoney(price, { locale, currencySuffix: all.currencySuffix }),
                    )}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label={text.code} hint={text.codeHint} error={say('code')}>
          {(control) => (
            <Input
              {...control}
              value={form.code}
              disabled={busy}
              onChange={(event) => set({ code: event.target.value })}
            />
          )}
        </Field>
        <CatalogErrorNotice error={error} labels={input} />
      </form>
    </Dialog>
  )
}
