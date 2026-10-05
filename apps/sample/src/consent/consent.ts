import { createConsentStore } from '@skeleton/marketing'

/**
 * 동의 선택 저장소(브라우저 `localStorage` 의 `notes:consent`) — 범주를 더하거나 문구를 바꾸면 `version` 을 올린다(다시 묻는다).
 * **이 샘플은 분석 코드를 넣지 않았다.** 넣는다면 허용된 뒤에만 켠다:
 *   onChange: (state) => (state.choices.analytics ? startAnalytics() : stopAnalytics())   // 그리고 시작할 때 `consent.has('analytics')` 확인
 */
export const consent = createConsentStore({
  categories: ['necessary', 'analytics'],
  version: '1',
  storageKey: 'notes:consent',
})
