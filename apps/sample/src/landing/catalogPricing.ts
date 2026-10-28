import type { PricingPlan } from '@skeleton/marketing'
import {
  toMajorUnits,
  type Catalog,
  type CatalogPrice,
  type CatalogProduct,
} from '@skeleton/payment'

type Options = {
  /** 이름 · 설명을 읽을 언어 */
  language: 'ko' | 'en'
  /** 맨 앞의 무료 카드(사전의 글자 - 카탈로그에 없다) */
  free: PricingPlan
  /** 상품 코드의 기능 목록(사전) - 없으면 빈 목록 */
  featuresOf: (productCode: string) => string[]
  ctaLabel: string
}

const INTERVAL_OF: Record<string, 'monthly' | 'yearly'> = { P1M: 'monthly', P1Y: 'yearly' }

function textOf(product: CatalogProduct, language: 'ko' | 'en') {
  return (
    product.texts[language] ??
    product.texts.en ??
    Object.values(product.texts)[0] ?? { name: product.code, description: null }
  )
}

/**
 * 공개 카탈로그 → 가격표(`PricingTable`)의 요금제들. 앞에 무료 카드, 이어 상품을 서버 순서대로.
 * 한 달(`P1M`) · 한 해(`P1Y`) 가격만 주기가 된다(다른 주기 · 단건은 이 표에 없다). 금액은 통화 최소 단위 → 기본 단위로 바꾸고,
 * 통화는 서버가 방문 나라로 정한 것(`catalog.currency` - 없으면 첫 가격의 통화)이며 다른 통화 가격은 뺀다.
 * 팔 상품이 하나도 없으면 `null` - 무료 카드만 있는 가격표는 그리지 않는다.
 */
export function catalogPricing(
  catalog: Catalog,
  { language, free, featuresOf, ctaLabel }: Options,
): { currency: string; plans: PricingPlan[] } | null {
  const currency =
    catalog.currency ?? catalog.products.flatMap((product) => product.prices)[0]?.currency
  if (!currency) return null
  const paid: PricingPlan[] = []
  for (const product of catalog.products) {
    const prices = product.prices.filter((p) => p.currency === currency)
    const byInterval = (interval: 'monthly' | 'yearly'): CatalogPrice | undefined =>
      prices.find((p) => p.period !== null && INTERVAL_OF[p.period] === interval)
    const monthly = byInterval('monthly')
    const yearly = byInterval('yearly')
    if (!monthly && !yearly) continue
    const plan: PricingPlan = {
      id: product.code,
      name: textOf(product, language).name,
      price: {
        monthly: monthly ? toMajorUnits(monthly.amount, currency) : null,
        yearly: yearly ? toMajorUnits(yearly.amount, currency) : null,
      },
      features: featuresOf(product.code),
      ctaLabel,
      ...(product.highlighted ? { highlighted: true } : {}),
    }
    const description = textOf(product, language).description
    if (description) plan.description = description
    for (const [interval, price] of [
      ['monthly', monthly],
      ['yearly', yearly],
    ] as const) {
      if (!price?.compareAtAmount) continue
      plan.compareAt = {
        ...plan.compareAt,
        [interval]: toMajorUnits(price.compareAtAmount, currency),
      }
      if (price.saleEndsAt) plan.saleEndsAt = { ...plan.saleEndsAt, [interval]: price.saleEndsAt }
    }
    paid.push(plan)
  }
  return paid.length > 0 ? { currency, plans: [free, ...paid] } : null
}
