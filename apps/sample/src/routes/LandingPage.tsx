import {
  CtaBand,
  FaqAccordion,
  FeatureGrid,
  Hero,
  PricingTable,
  Testimonial,
  type BillingInterval,
} from '@skeleton/marketing'
import { useCatalogProducts } from '@skeleton/payment'
import { userTimeZone } from '@skeleton/time'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { catalogApi, QUIET_CATALOG } from '../catalog/api'
import { LinkButton } from '../components/LinkButton'
import { catalogPricing } from '../landing/catalogPricing'
import { i18n, languageOf, useT, type MessageKey } from '../i18n'
import styles from './LandingPage.module.css'

/**
 * 로그인하지 않은 방문자의 첫 화면(`/`) — Patterns/Landing 을 옮긴 것: Hero → 기능 → 한마디 → 요금제 → FAQ → 마지막 권유.
 * 글자는 모두 `landing.*` 사전에서. 요금제는 앞의 무료 카드만 사전이고 나머지는 공개 카탈로그(`GET /catalog/products`)에서 온다 -
 * 통화는 서버가 방문 나라로 정하고(`currency`), 화면 언어는 서식(로케일)만 정한다. 읽는 중 · 실패 · 팔 상품이 없으면 가격표 자리를 그리지 않는다.
 * 이 샘플의 「시작하기」는 모두 가입으로 간다.
 */
export function LandingPage() {
  const { t, locale } = useT()
  const navigate = useNavigate()
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const language = languageOf(locale)
  const catalog = useCatalogProducts(catalogApi, 'SUBSCRIPTION', QUIET_CATALOG)
  const pricing = catalog.data
    ? catalogPricing(catalog.data, {
        language,
        free: {
          id: 'free',
          name: t('landing.plan.free.name'),
          description: t('landing.plan.free.description'),
          price: { monthly: 0, yearly: 0 },
          features: [t('landing.plan.free.f1'), t('landing.plan.free.f2')],
          ctaLabel: t('landing.plan.free.cta'),
        },
        featuresOf: featuresFor(t),
        ctaLabel: t('landing.pricing.cta'),
      })
    : null

  return (
    <div className={styles.page}>
      <Hero
        eyebrow={t('landing.eyebrow')}
        title={t('landing.title')}
        subtitle={t('landing.subtitle')}
        primaryAction={<LinkButton to="/sign-up">{t('landing.primary')}</LinkButton>}
        secondaryAction={
          pricing && (
            <a className={styles.anchor} href="#pricing">
              {t('landing.secondary')}
            </a>
          )
        }
      />
      <FeatureGrid
        title={t('landing.features.title')}
        features={[
          {
            id: 'search',
            icon: '⌕',
            title: t('landing.feature.search.title'),
            description: t('landing.feature.search.body'),
          },
          {
            id: 'files',
            icon: '▤',
            title: t('landing.feature.files.title'),
            description: t('landing.feature.files.body'),
          },
          {
            id: 'share',
            icon: '↗',
            title: t('landing.feature.share.title'),
            description: t('landing.feature.share.body'),
          },
        ]}
      />
      <section className={styles.band}>
        <Testimonial
          quote={t('landing.quote.text')}
          author={t('landing.quote.author')}
          role={t('landing.quote.role')}
        />
      </section>
      {pricing && (
        <div id="pricing" className={styles.band}>
          <PricingTable
            title={t('landing.pricing.title')}
            subtitle={t('landing.pricing.subtitle')}
            plans={pricing.plans}
            interval={interval}
            onIntervalChange={setInterval}
            onSelect={() => navigate('/sign-up')}
            currency={pricing.currency}
            locale={language === 'ko' ? 'ko-KR' : 'en-US'}
            timeZone={userTimeZone()}
            labels={{
              interval: t('landing.pricing.interval'),
              monthly: t('landing.pricing.monthly'),
              yearly: t('landing.pricing.yearly'),
              yearlySavings: (percent) => t('landing.pricing.savings', { percent }),
              perMonth: t('landing.pricing.perMonth'),
              billedYearly: (total) => t('landing.pricing.billedYearly', { total }),
              free: t('landing.pricing.free'),
              custom: t('landing.pricing.custom'),
              highlight: t('landing.pricing.highlight'),
              saleUntil: (date) => t('landing.pricing.saleUntil', { date }),
            }}
          />
        </div>
      )}
      <div id="faq" className={styles.band}>
        <FaqAccordion
          title={t('landing.faq.title')}
          exclusive
          items={(['1', '2', '3'] as const).map((n) => ({
            id: `q${n}`,
            question: t(`landing.faq.q${n}`),
            answer: <p>{t(`landing.faq.a${n}`)}</p>,
          }))}
        />
      </div>
      <section className={styles.band}>
        <CtaBand
          title={t('landing.cta.title')}
          description={t('landing.cta.body')}
          action={
            <LinkButton to="/sign-up" variant="inverse">
              {t('landing.cta.action')}
            </LinkButton>
          }
        />
      </section>
    </div>
  )
}

/** 상품 코드의 기능 목록 - 사전의 `landing.pricing.features.<코드>.1, 2, …` 를 키가 끊길 때까지 읽는다(없는 코드는 빈 목록) */
const featuresFor = (t: (key: MessageKey) => string) => (productCode: string) => {
  const features: string[] = []
  for (let n = 1; i18n.has(`landing.pricing.features.${productCode}.${n}`); n++)
    features.push(t(`landing.pricing.features.${productCode}.${n}` as MessageKey))
  return features
}
