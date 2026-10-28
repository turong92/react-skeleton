import { useCan } from '@skeleton/auth'
import { AdminCampaigns, useAdminCouponDefinitions } from '@skeleton/rewards/admin'
import { languageOf, useT } from '../i18n'
import { rewardsAdminApi } from '../rewards/api'
import { rewardsAdminLabelsFor } from '../rewards/labels'

/**
 * 운영자 화면 - `@skeleton/rewards/admin` 의 `AdminCampaigns`. 백엔드는 해당 모듈의 `skeleton.<module>.admin.enabled=true`(이 앱은 켠다)와 운영 권한이 필요하고,
 * 단추는 `useCan()` 으로 숨긴다(서버가 다시 판정한다). 필요 없는 프로젝트는 이 파일과 라우트 · 메뉴 한 줄을 지운다.
 */
export function AdminCampaignsPage() {
  const { locale } = useT()
  const language = languageOf(locale)
  const can = useCan()
  // 쿠폰 보상에서 고를 쿠폰 이름 - 쿠폰 운영 권한이 있을 때만 읽는다(없으면 쿠폰 id 를 직접 적는다)
  const definitions = useAdminCouponDefinitions(rewardsAdminApi, {
    enabled: can('coupon.manage'),
  })
  return (
    <AdminCampaigns
      api={rewardsAdminApi}
      can={can}
      labels={rewardsAdminLabelsFor(language)}
      locale={language}
      couponChoices={
        definitions.data ? definitions.data.map((d) => ({ id: d.id, name: d.name })) : undefined
      }
    />
  )
}
