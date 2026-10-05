import type { PricingPlan } from '@skeleton/marketing'

type Price = { monthly: number; yearly: number }

/** 샘플의 가격 — 언어의 통화로(한국어 = 원, 영어 = 달러). 연 결제는 월 결제의 10개월치(약 17% 할인) 근처. 실제 서비스는 결제 설정(서버)에서 온다 */
export function pricingFor(locale: 'ko' | 'en'): {
  currency: string
  locale: string
  prices: { free: Price; pro: Price; team: Price }
} {
  return locale === 'ko'
    ? {
        currency: 'KRW',
        locale: 'ko-KR',
        prices: {
          free: { monthly: 0, yearly: 0 },
          pro: { monthly: 9900, yearly: 99000 },
          team: { monthly: 24900, yearly: 249000 },
        },
      }
    : {
        currency: 'USD',
        locale: 'en-US',
        prices: {
          free: { monthly: 0, yearly: 0 },
          pro: { monthly: 10, yearly: 100 },
          team: { monthly: 25, yearly: 250 },
        },
      }
}

export type PlanTexts = Pick<PricingPlan, 'name' | 'description' | 'features' | 'ctaLabel'>
