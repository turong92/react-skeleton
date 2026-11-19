import { koAuthLabels, reauthSubjectOf, type ProviderRoundTrip } from '@skeleton/auth'
import { ApiKeysSection, koApiKeysLabels } from '@skeleton/auth/api-keys'
import { apiKeysApi } from '../apiKeys/api'
import { API_KEY_MAX_LIFETIME_DAYS, noteScopeLabels } from '../apiKeys/scopeLabels'
import { useT } from '../i18n'
import { accountApi } from './session'
import { useMyProfile } from './useMyProfile'

/**
 * 계정 설정 「환경」 카드의 「API 키」 줄 - 키를 만들 때 본인 확인(비밀번호 · 메일 코드 · 소셜 제공자)을 내 계정 정보로 고른다.
 * 소셜 전용 계정은 제공자 동의 화면에 다녀와야 해서 그 왕복(`trip`)을 이어 주는 계정 설정 안에 둔다 - 프로필을 읽은 뒤에 그린다.
 */
export function AccountApiKeys({ trip }: { trip: ProviderRoundTrip }) {
  const { t, locale } = useT()
  const profile = useMyProfile().data
  if (!profile) return null
  return (
    <ApiKeysSection
      row
      api={apiKeysApi}
      subject={reauthSubjectOf(profile)}
      requestReauthCode={accountApi.requestReauthConfirmation}
      scopeLabels={noteScopeLabels(t)}
      maxLifetimeDays={API_KEY_MAX_LIFETIME_DAYS}
      labels={locale === 'ko' ? koApiKeysLabels : undefined}
      authLabels={locale === 'ko' ? koAuthLabels : undefined}
      onProviderReauth={trip.onProviderReauth}
      resume={trip.resume}
      onResumeSpent={trip.onResumeSpent}
    />
  )
}
