import { useCan } from '@skeleton/auth'
import { AdminPoints } from '@skeleton/rewards/admin'
import { languageOf, useT } from '../i18n'
import { rewardsAdminApi } from '../rewards/api'
import { rewardsAdminLabelsFor } from '../rewards/labels'

/**
 * 운영자 화면 - `@skeleton/rewards/admin` 의 `AdminPoints`. 백엔드는 해당 모듈의 `skeleton.<module>.admin.enabled=true`(이 앱은 켠다)와 운영 권한이 필요하고,
 * 단추는 `useCan()` 으로 숨긴다(서버가 다시 판정한다). 필요 없는 프로젝트는 이 파일과 라우트 · 메뉴 한 줄을 지운다.
 */
export function AdminPointsPage() {
  const { locale } = useT()
  const language = languageOf(locale)
  const can = useCan()

  return (
    <AdminPoints
      api={rewardsAdminApi}
      can={can}
      labels={rewardsAdminLabelsFor(language)}
      locale={language}
    />
  )
}
