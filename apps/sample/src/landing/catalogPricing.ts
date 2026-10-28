import type { PricingPlan } from '@skeleton/marketing'
import {
  periodMinutes,
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

function textOf(product: CatalogProduct, language: 'ko' | 'en') {
  return (
    product.texts[language] ??
    product.texts.en ??
    Object.values(product.texts)[0] ?? { name: product.code, description: null }
  )
}

/**
 * 상품의 주기 가격 둘 - 짧은 주기가 「월」, 긴 주기가 「연」이다(견본 로컬 시드는 3분 · 36분 주기라 `P1M` · `P1Y` 로 못 박지 않는다).
 * 주기가 하나뿐이면 `P1Y` 만 연으로, 그 밖은 월로 본다. 주기가 셋 이상이면 가장 짧은 것과 가장 긴 것만 쓴다. 주기 없는(단건) 가격은 뺀다
 */
function intervalsOf(prices: CatalogPrice[]): [CatalogPrice | undefined, CatalogPrice | undefined] {
  const sorted = prices
    .filter((p) => p.period !== null)
    .sort((a, b) => periodMinutes(a.period!) - periodMinutes(b.period!))
  if (sorted.length === 0) return [undefined, undefined]
  if (sorted.length === 1)
    return sorted[0]!.period === 'P1Y' ? [undefined, sorted[0]] : [sorted[0], undefined]
  return [sorted[0], sorted[sorted.length - 1]]
}

/**
 * 공개 카탈로그 → 가격표(`PricingTable`)의 요금제들. 앞에 무료 카드, 이어 상품을 서버 순서대로.
 * 상품의 짧은 주기 가격이 월, 긴 주기 가격이 연이다(단건은 이 표에 없다). 금액은 통화 최소 단위 → 기본 단위로 바꾸고,
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
    const [monthly, yearly] = intervalsOf(prices)
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
