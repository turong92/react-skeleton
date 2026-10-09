import { ConsentSettings } from '@skeleton/legal'
import { legalApi } from '../api/legal'
import { useLegalLocale } from './useLegalLocale'

/** 계정 설정 「환경」 카드의 「약관 동의」 줄 — 「보기」가 여는 대화상자에 상태 · 동의한 판 · 선택 동의 철회 · 이력 */
export function ConsentSettingsSection() {
  const { locale, formatLocale, labels } = useLegalLocale()
  return (
    <ConsentSettings
      row
      api={legalApi}
      locale={locale}
      fallbackLocale="ko"
      formatLocale={formatLocale}
      labels={labels}
    />
  )
}
