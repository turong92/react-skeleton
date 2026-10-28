import type { CatalogKind } from '../catalogTypes'
import { fractionDigits, parseAmountInput } from './amountInput'
import type { AddCatalogPriceInput } from './catalogAdminTypes'

/** 「가격 더하기」 폼이 쥔 글자들 */
export type AddPriceForm = {
  code: string
  /** `P1M` · `P1Y` 또는 `custom`(= `customPeriod`) */
  period: string
  customPeriod: string
  amount: string
  /** `KRW` · `USD` 또는 `custom`(= `customCurrency`) */
  currency: string
  customCurrency: string
  sale: boolean
  regularAmount: string
  /** `datetime-local` 값(`2026-11-30T09:00`) - 내 기기의 시간대로 읽는다 */
  saleStartsAt: string
  saleEndsAt: string
}

export const EMPTY_ADD_PRICE_FORM: AddPriceForm = {
  code: '',
  period: 'P1M',
  customPeriod: '',
  amount: '',
  currency: 'KRW',
  customCurrency: '',
  sale: false,
  regularAmount: '',
  saleStartsAt: '',
  saleEndsAt: '',
}

export type AddPriceProblems = Partial<
  Record<
    'period' | 'amount' | 'currency' | 'regularAmount' | 'saleStartsAt' | 'saleEndsAt' | 'code',
    | 'amountEmpty'
    | 'amountInvalid'
    | 'amountZero'
    | 'periodInvalid'
    | 'currencyInvalid'
    | 'regularNotAbove'
    | 'regularEmpty'
    | 'endBeforeStart'
    | 'timeInvalid'
    | 'codeInvalid'
  >
>

/** ISO-8601 주기 - `P1M` · `P1Y` · `P3M` · `P2W` · `P1DT12H` … (빈 주기 · 날짜 없는 `PT` 는 아니다) */
/** 가격 코드 - 상품 코드와 같은 모양(백엔드와 같다: 소문자 · 숫자로 시작, `-` `_` 허용, 64자까지) */
const PRICE_CODE = /^[a-z0-9][a-z0-9_-]{0,63}$/

const ISO_PERIOD = /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/

export const currencyOf = (form: Pick<AddPriceForm, 'currency' | 'customCurrency'>): string =>
  form.currency === 'custom' ? form.customCurrency.trim().toUpperCase() : form.currency

/** `datetime-local` 글자 → 순간(ISO-8601). 읽을 수 없으면 `null` */
function instantOf(local: string): string | null {
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * 폼 → 서버로 보낼 값. 금액은 글자를 잘라 읽어 통화의 최소 단위 정수로(`parseAmountInput` - 부동소수를 거치지 않는다).
 * 틀린 칸이 있으면 `input` 없이 칸별 이유만 돌려준다 - 서버(`CATALOG.PRICE_INVALID`)가 최종 판단이다.
 * 행사가는 시작이 비어도 **시작을 지금(`now`)으로 채워 보낸다** - 시작과 끝이 모두 없으면 서버는 상시 가격으로 읽는다.
 */
export function validateAddPrice(
  form: AddPriceForm,
  kind: CatalogKind,
  now: Date = new Date(),
): { input: AddCatalogPriceInput; problems: null } | { input: null; problems: AddPriceProblems } {
  const problems: AddPriceProblems = {}
  const currency = currencyOf(form)
  if (!/^[A-Z]{3}$/.test(currency)) problems.currency = 'currencyInvalid'
  const digits = fractionDigits(currency)

  const period = form.period === 'custom' ? form.customPeriod.trim() : form.period
  if (kind === 'SUBSCRIPTION' && !ISO_PERIOD.test(period)) problems.period = 'periodInvalid'

  const amount = parseAmountInput(form.amount, digits)
  if (amount.kind === 'empty') problems.amount = 'amountEmpty'
  else if (amount.kind === 'invalid') problems.amount = 'amountInvalid'
  else if (amount.minor <= 0) problems.amount = 'amountZero'

  let compareAtAmount: number | undefined
  let saleStartsAt: string | undefined
  let saleEndsAt: string | undefined
  if (form.sale) {
    const regular = parseAmountInput(form.regularAmount, digits)
    if (regular.kind === 'empty') problems.regularAmount = 'regularEmpty'
    else if (regular.kind === 'invalid') problems.regularAmount = 'amountInvalid'
    else if (amount.kind === 'ok' && regular.minor <= amount.minor)
      problems.regularAmount = 'regularNotAbove'
    else if (regular.kind === 'ok') compareAtAmount = regular.minor

    if (form.saleStartsAt !== '') {
      const at = instantOf(form.saleStartsAt)
      if (at === null) problems.saleStartsAt = 'timeInvalid'
      else saleStartsAt = at
    }
    // 시작이 비었으면 지금부터 - 행사가가 상시 가격으로 읽히지 않게
    if (!saleStartsAt && !problems.saleStartsAt) saleStartsAt = now.toISOString()
    if (form.saleEndsAt !== '') {
      const at = instantOf(form.saleEndsAt)
      if (at === null) problems.saleEndsAt = 'timeInvalid'
      else saleEndsAt = at
    }
    if (saleStartsAt && saleEndsAt && new Date(saleEndsAt) <= new Date(saleStartsAt))
      problems.saleEndsAt = 'endBeforeStart'
  }

  if (Object.keys(problems).length > 0 || amount.kind !== 'ok') return { input: null, problems }
  const code = form.code.trim()
  if (code !== '' && !PRICE_CODE.test(code))
    return { input: null, problems: { code: 'codeInvalid' } }
  return {
    problems: null,
    input: {
      ...(code !== '' ? { code } : {}),
      ...(kind === 'SUBSCRIPTION' ? { period } : {}),
      amount: amount.minor,
      currency,
      ...(compareAtAmount !== undefined ? { compareAtAmount } : {}),
      ...(saleStartsAt ? { saleStartsAt } : {}),
      ...(saleEndsAt ? { saleEndsAt } : {}),
    },
  }
}
