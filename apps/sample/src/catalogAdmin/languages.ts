/** 상품 이름 · 설명을 적는 언어 — 이 앱의 사전 언어(ko · en)와 같다. 언어를 더하면 여기에 한 줄 */
export type ProductLanguage = { code: string; label: string }

export const PRODUCT_LANGUAGES: readonly ProductLanguage[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
]
