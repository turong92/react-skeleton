import { defaultPaymentLabels, koPaymentLabels } from '@skeleton/payment'
import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { paymentLabelsFor } from './paymentLabels'

const t = (locale: 'ko' | 'en') => (key: Parameters<typeof i18n.t>[0]) => i18n.tIn(locale, key)

describe("paymentLabelsFor — the package words, with this app's cheer words where a screen is about cheers", () => {
  it('Korean: the package Korean words, and the list and result say 「내 응원 내역」 instead of 「결제 내역」', async () => {
    await i18n.setLocale('en', { remember: false }) // en 사전을 불러 둔다
    await i18n.setLocale('ko', { remember: false })
    const labels = paymentLabelsFor(t('ko'), 'ko')
    expect(labels.orderStatus).toEqual(koPaymentLabels.orderStatus)
    expect(labels.summary.requestRefund).toBe('환불 요청')
    expect(labels.list.caption).toBe('내 응원 내역')
    expect(labels.result.viewHistory).toBe('내 응원 내역')
    expect(labels.list.emptyTitle).toBe('아직 응원한 내역이 없어요')
    // 덮지 않은 것은 패키지 그대로
    expect(labels.refundDialog.dismiss).toBe('닫기')
  })

  it('English: the package English words with the same overrides in English', async () => {
    await i18n.setLocale('en', { remember: false })
    const labels = paymentLabelsFor(t('en'), 'en')
    expect(labels.orderStatus).toEqual(defaultPaymentLabels.orderStatus)
    expect(labels.list.caption).toBe(i18n.tIn('en', 'cheer.history.title'))
    expect(labels.list.caption).not.toMatch(/[가-힣]/)
    expect(labels.result.viewHistory).toBe(i18n.tIn('en', 'cheer.history.title'))
    await i18n.setLocale('ko', { remember: false })
  })

  it('no Korean letters are left in the English labels (screen readers read them too)', () => {
    const leaves = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : typeof value === 'function'
          ? [String((value as (x: string) => unknown)('X'))]
          : value && typeof value === 'object'
            ? Object.values(value).flatMap(leaves)
            : []
    const labels = paymentLabelsFor(t('en'), 'en')
    expect(leaves(labels).filter((text) => /[가-힣]/.test(text))).toEqual([])
  })
})
