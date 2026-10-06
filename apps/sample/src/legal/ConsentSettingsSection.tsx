import { ConsentSettings } from '@skeleton/legal'
import { legalApi } from '../api/legal'
import { useLegalLocale } from './useLegalLocale'

/** 계정 설정 아래 「약관 동의」 절 — 상태 · 동의한 판 · 선택 동의 철회 · 이력 */
export function ConsentSettingsSection() {
  const { locale, formatLocale, labels } = useLegalLocale()
  return (
    <ConsentSettings
      api={legalApi}
      locale={locale}
      fallbackLocale="ko"
      formatLocale={formatLocale}
      labels={labels}
    />
  )
}
