import { useCan } from '@skeleton/auth'
import { AdminCouponDefinition } from '@skeleton/rewards/admin'
import { useParams } from 'react-router-dom'
import { LinkButton } from '../components/LinkButton'
import { TextLink } from '../components/TextLink'
import { languageOf, useT } from '../i18n'
import { rewardsAdminApi } from '../rewards/api'
import { rewardsAdminLabelsFor, rewardsLabelsFor } from '../rewards/labels'

/**
 * 쿠폰 정의 한 건 - 현황 카드와 발급 내역(`@skeleton/rewards/admin` 의 `AdminCouponDefinition`). 계정 칸은 계정 한 건 화면(`/admin/accounts/:id`)으로 잇는다.
 * 백엔드 `skeleton.coupon.admin.enabled=true`(이 앱은 켠다) + `coupon.manage`
 */
export function AdminCouponDefinitionPage() {
  const { id = '' } = useParams()
  const { locale } = useT()
  const language = languageOf(locale)
  const labels = rewardsAdminLabelsFor(language)
  return (
    <AdminCouponDefinition
      api={rewardsAdminApi}
      definitionId={id}
      can={useCan()}
      labels={labels}
      userLabels={rewardsLabelsFor(language)}
      locale={language}
      back={
        <LinkButton to="/admin/coupons" variant="secondary">
          {labels.couponDetail.back}
        </LinkButton>
      }
      renderAccountLink={(accountId, children) => (
        <TextLink to={`/admin/accounts/${encodeURIComponent(accountId)}`}>{children}</TextLink>
      )}
    />
  )
}
