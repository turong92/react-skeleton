import { usePaymentConfig } from '@skeleton/payment'
import { paymentApi } from '../cheer/api'
import { LinkButton } from '../components/LinkButton'
import { languageOf, useT } from '../i18n'
import { countryName } from '../subscription/country'
import { policyLinesOf } from './countryPolicy'
import styles from './CountryPolicyNotice.module.css'

/**
 * 결제하는 나라와 그 나라의 해지·환불 규칙 - **보여 주기 전용**이다. 나라 · 결제사 · 정책은 서버가 접속 나라로 정하고 화면은 못 바꾼다.
 * 서버가 아직 안 답했거나 정책을 모르면 아무것도 그리지 않는다.
 */
export function CountryPolicyNotice() {
  const { t, locale } = useT()
  const config = usePaymentConfig(paymentApi)
  const lines = policyLinesOf(config.data?.cancelPolicy, config.data?.provider)
  if (lines.length === 0) return null
  const country = config.data?.country
  return (
    <div className={styles.notice}>
      {country && (
        <p className={styles.country}>
          {t('payment.country.line', { country: countryName(country, languageOf(locale)) })}
        </p>
      )}
      <ul className={styles.lines}>
        {lines.map((line) => (
          <li key={line.key}>{t(line.key, line.values)}</li>
        ))}
      </ul>
      <div>
        <LinkButton to="/refund" variant="secondary">
          {t('subscription.refundPolicy')}
        </LinkButton>
      </div>
    </div>
  )
}
