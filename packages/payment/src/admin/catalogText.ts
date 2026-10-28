import type { CatalogProductText } from '../catalogTypes'
import type { CatalogAdminLabels } from '../labels.catalogAdmin'

/** 화면 언어(`ko-KR` → `ko`)의 상품 글 - 없으면 영어, 그것도 없으면 있는 첫 언어, 모두 없으면 코드 */
export function productTextOf(
  product: { code: string; texts: Record<string, CatalogProductText> },
  locale?: string,
): CatalogProductText {
  const language = (locale ?? 'en').split('-')[0] ?? 'en'
  return (
    product.texts[language] ??
    product.texts.en ??
    Object.values(product.texts)[0] ?? { name: product.code, description: null }
  )
}

/** 가격 주기의 짧은 이름 - 한 달 · 한 해는 낱말, 단건은 「한 번」, 그 밖은 주기 코드 그대로 */
export function periodName(
  period: string | null,
  labels: Pick<CatalogAdminLabels['prices'], 'periods'>,
): string {
  if (period === null) return labels.periods.once
  if (period === 'P1M') return labels.periods.monthly
  if (period === 'P1Y') return labels.periods.yearly
  return period
}
