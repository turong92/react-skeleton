/** 앱 스토어가 과금하는 구독의 결제사 id(`GET /subscriptions/me` 의 `subscription.provider`) - 서버는 이 구독의 해지 · 플랜 변경을 하지 못한다(409 `SUBSCRIPTION_MANAGED_BY_STORE`) */
export type BillingStore = 'appstore' | 'googleplay'

/** 각 스토어의 구독 관리 화면(공식 주소) - 해지 · 변경은 여기서 한다 */
export const STORE_SUBSCRIPTIONS_URL: Record<BillingStore, string> = {
  appstore: 'https://apps.apple.com/account/subscriptions',
  googleplay: 'https://play.google.com/store/account/subscriptions',
}

/** 이 결제사가 앱 스토어면 그 스토어, 아니면 `null`(칸이 없는 구버전 서버 포함) */
export function storeOf(provider: string | null | undefined): BillingStore | null {
  return provider === 'appstore' || provider === 'googleplay' ? provider : null
}
