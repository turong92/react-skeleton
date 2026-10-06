import { ConsentSettings, koLegalLabels } from '@skeleton/legal'
import { useLegalApi } from './useLegalApi'

/** 계정 설정 아래 「약관 동의」 절 */
export function ConsentSettingsSection() {
  return <ConsentSettings api={useLegalApi()} locale="ko" labels={koLegalLabels} />
}
