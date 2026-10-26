import { createConsentStore } from '@skeleton/marketing'

/**
 * 동의 선택 저장소(브라우저 `localStorage` 의 `notes:consent`) — 범주를 더하거나 문구를 바꾸면 `version` 을 올린다(다시 묻는다).
 * 분석 코드는 `main.tsx` 의 `createAnalyticsLoader` 가 이 저장소를 따라 켠다 - `analytics` 에 동의한 뒤에만 GA(`VITE_GA_MEASUREMENT_ID`)를 붙이고,
 * Cloudflare 비콘(`VITE_CF_BEACON_TOKEN`)은 쿠키가 없어 토큰이 있으면 붙는다.
 */
export const consent = createConsentStore({
  categories: ['necessary', 'analytics'],
  version: '1',
  storageKey: 'notes:consent',
})
