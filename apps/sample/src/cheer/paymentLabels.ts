import { koPaymentLabels, resolvePaymentLabels, type PaymentLabels } from '@skeleton/payment'
import type { MessageKey } from '../i18n'

/**
 * `@skeleton/payment` 부품에 넘기는 문구 — 낱말은 패키지의 것(결제 · 환불 · 결제 확인 중 …)이고, 이 앱이 응원 이야기를 하는 곳
 * (목록 이름 · 비었을 때 · 결과 화면의 다음 걸음)만 사전(`cheer.*`)의 말로 덮는다. 언어를 바꾸면 따라 바뀐다
 */
export function paymentLabelsFor(
  t: (key: MessageKey) => string,
  locale: 'ko' | 'en',
): PaymentLabels {
  const base = resolvePaymentLabels(locale === 'ko' ? koPaymentLabels : undefined)
  return {
    ...base,
    list: {
      ...base.list,
      caption: t('cheer.history.title'),
      emptyTitle: t('cheer.history.emptyTitle'),
      emptyDescription: t('cheer.history.emptyBody'),
    },
    result: { ...base.result, viewHistory: t('cheer.history.title') },
  }
}
