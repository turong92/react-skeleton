import {
  CtaBand,
  FaqAccordion,
  FeatureGrid,
  Hero,
  PricingTable,
  Testimonial,
  type BillingInterval,
  type PricingPlan,
} from '@skeleton/marketing'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LinkButton } from '../components/LinkButton'
import { pricingFor } from '../landing/pricingData'
import { languageOf, useT } from '../i18n'
import styles from './LandingPage.module.css'

/**
 * 로그인하지 않은 방문자의 첫 화면(`/`) — Patterns/Landing 을 옮긴 것: Hero → 기능 → 한마디 → 요금제 → FAQ → 마지막 권유.
 * 글자는 모두 `landing.*` 사전에서, 요금제 금액은 언어의 통화로(`pricingFor`). 이 샘플에는 가입 · 결제가 없어 모든 행동이 로그인으로 간다.
 */
export function LandingPage() {
  const { t, locale } = useT()
  const navigate = useNavigate()
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const money = pricingFor(languageOf(locale))

  const plans: PricingPlan[] = [
    {
      id: 'free',
      name: t('landing.plan.free.name'),
      description: t('landing.plan.free.description'),
      price: money.prices.free,
      features: [t('landing.plan.free.f1'), t('landing.plan.free.f2')],
      ctaLabel: t('landing.plan.free.cta'),
    },
    {
      id: 'pro',
      name: t('landing.plan.pro.name'),
      description: t('landing.plan.pro.description'),
      price: money.prices.pro,
      features: [t('landing.plan.pro.f1'), t('landing.plan.pro.f2'), t('landing.plan.pro.f3')],
      ctaLabel: t('landing.plan.pro.cta'),
      highlighted: true,
    },
    {
      id: 'team',
      name: t('landing.plan.team.name'),
      description: t('landing.plan.team.description'),
      price: money.prices.team,
      features: [t('landing.plan.team.f1'), t('landing.plan.team.f2')],
      ctaLabel: t('landing.plan.team.cta'),
    },
  ]

  return (
    <div className={styles.page}>
      <Hero
        eyebrow={t('landing.eyebrow')}
        title={t('landing.title')}
        subtitle={t('landing.subtitle')}
        primaryAction={<LinkButton to="/sign-up">{t('landing.primary')}</LinkButton>}
        secondaryAction={
          <a className={styles.anchor} href="#pricing">
            {t('landing.secondary')}
          </a>
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
      <div id="pricing" className={styles.band}>
        <PricingTable
          title={t('landing.pricing.title')}
          subtitle={t('landing.pricing.subtitle')}
          plans={plans}
          interval={interval}
          onIntervalChange={setInterval}
          onSelect={() => navigate('/sign-up')}
          currency={money.currency}
          locale={money.locale}
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
          }}
        />
      </div>
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
