import { useCatalogProducts } from '@skeleton/payment'
import { catalogApi, QUIET_CATALOG } from '../catalog/api'
import { i18n, languageOf, useT, type MessageKey } from '../i18n'
import { catalogPricing } from './catalogPricing'

/**
 * 가격표 - 앞의 무료 카드(사전) + 공개 카탈로그. 읽는 중 · 실패 · 팔 상품 없음이면 `null`(가격표도, 가격표로 가는 링크도 그리지 않는다).
 * 랜딩과 푸터가 같은 카탈로그 쿼리를 나눠 쓴다. `enabled: false` 면 읽지도 않는다(로그인한 사람의 푸터)
 */
export function usePricing(enabled = true) {
  const { t, locale } = useT()
  const catalog = useCatalogProducts(catalogApi, 'SUBSCRIPTION', { ...QUIET_CATALOG, enabled })
  if (!enabled || !catalog.data) return null
  return catalogPricing(catalog.data, {
    language: languageOf(locale),
    free: {
      id: 'free',
      name: t('landing.plan.free.name'),
      description: t('landing.plan.free.description'),
      price: { monthly: 0, yearly: 0 },
      features: [t('landing.plan.free.f1'), t('landing.plan.free.f2')],
      ctaLabel: t('landing.plan.free.cta'),
    },
    featuresOf: (productCode) => {
      const features: string[] = []
      for (let n = 1; i18n.has(`landing.pricing.features.${productCode}.${n}`); n++)
        features.push(t(`landing.pricing.features.${productCode}.${n}` as MessageKey))
      return features
    },
    ctaLabel: t('landing.pricing.cta'),
  })
}
