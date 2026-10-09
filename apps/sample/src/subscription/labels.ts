import { koPaymentLabels, resolvePaymentLabels, type PaymentLabels } from '@skeleton/payment'
import type { MessageKey } from '../i18n'

/**
 * 구독 화면이 `@skeleton/payment` 부품에 넘기는 문구 — 낱말은 패키지의 것이고, 이 앱이 구독 이야기를 하는 곳(결과 화면의 「내 구독」 단추)만 사전(`subscription.*`)의 말로 덮는다.
 * 응원하기의 `paymentLabelsFor` 와 따로 둔다: 그쪽은 결제 내역을 「내 응원 내역」이라 부른다.
 */
export function subscriptionLabelsFor(
  t: (key: MessageKey) => string,
  locale: 'ko' | 'en',
): PaymentLabels {
  const base = resolvePaymentLabels(locale === 'ko' ? koPaymentLabels : undefined)
  return { ...base, result: { ...base.result, viewHistory: t('subscription.title') } }
}
