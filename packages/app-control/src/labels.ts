/** 이 패키지가 그리는 모든 문구 — 부품은 번역을 모른다. 앱이 `Partial<AppControlLabels>` 를 넘긴다(한국어: `koAppControlLabels`) */
export type AppControlLabels = {
  maintenanceTitle: string
  /** 운영자가 문구를 적지 않았을 때 */
  maintenanceBody: string
  /** 점검 끝 예정이 있을 때 한 줄 (`when` 은 읽기 좋게 바꾼 시각) */
  maintenanceEnds: (when: string) => string
  updateRequiredTitle: string
  updateRequiredBody: string
  /** 강제 화면 · 안내 띠의 버튼 — 웹은 새로고침 */
  updateAction: string
  updateRecommendedTitle: string
  updateRecommendedBody: string
  /** 안내 띠를 닫는 버튼의 이름 */
  later: string
}

export const defaultAppControlLabels: AppControlLabels = {
  maintenanceTitle: 'We are under maintenance',
  maintenanceBody: 'The service is temporarily unavailable. Please try again in a little while.',
  maintenanceEnds: (when) => `Expected back around ${when}.`,
  updateRequiredTitle: 'Please update to continue',
  updateRequiredBody: 'This version is no longer supported. Reload to get the latest version.',
  updateAction: 'Reload',
  updateRecommendedTitle: 'A new version is available',
  updateRecommendedBody: 'Reload to get the latest version.',
  later: 'Later',
}

export const koAppControlLabels: AppControlLabels = {
  maintenanceTitle: '지금은 점검 중이에요',
  maintenanceBody: '서비스를 잠시 쓸 수 없어요. 조금 뒤에 다시 들어와 주세요.',
  maintenanceEnds: (when) => `${when}쯤 다시 열릴 예정이에요.`,
  updateRequiredTitle: '업데이트가 필요해요',
  updateRequiredBody: '이 버전은 더 이상 지원하지 않아요. 새로고침해서 최신 버전을 받아 주세요.',
  updateAction: '새로고침',
  updateRecommendedTitle: '새 버전이 나왔어요',
  updateRecommendedBody: '새로고침하면 최신 버전을 쓸 수 있어요.',
  later: '나중에',
}

export function mergeAppControlLabels(overrides?: Partial<AppControlLabels>): AppControlLabels {
  return { ...defaultAppControlLabels, ...overrides }
}
