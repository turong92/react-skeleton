import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import {
  PaymentLedgerErrorCodes,
  PaymentRedirectError,
  readBillingReturn,
  type BillingAuth,
  type OpenBillingAuthOptions,
  type StartSubscriptionResult,
} from '@skeleton/payment'

/** 카드 등록 창이 돌려보낼 곳 — 이 앱의 한 화면(`/subscriptions/return`)이 성공 · 실패를 모두 받아 주소의 모양으로 가른다. 서버는 이 주소를 받지도 저장하지도 않는다 */
export function subscribeReturnUrls(
  origin: string,
  subscriptionId: string,
  provider?: string,
): Pick<OpenBillingAuthOptions, 'successUrl' | 'failUrl'> {
  // 카드 창은 성공 주소에 `authKey` · `customerKey` 만 덧붙인다 - 어느 구독인지는 우리가 주소에 싣는다
  const back = `${origin.replace(/\/+$/, '')}/subscriptions/return?sub=${encodeURIComponent(subscriptionId)}`
  // Paddle 은 카드 창이 따로 없고 첫 결제가 웹훅으로 닿는다 - 돌아온 화면은 서버를 되묻기만 한다
  const returnTo = provider === 'paddle' ? `${back}&provider=paddle` : back
  return { successUrl: returnTo, failUrl: returnTo }
}

export type StartSubscribeDeps = {
  start: (planCode: string) => Promise<StartSubscriptionResult>
  openBillingAuth: (
    billingAuth: BillingAuth,
    urls: Pick<OpenBillingAuthOptions, 'successUrl' | 'failUrl'>,
  ) => Promise<void>
  urlsFor: (
    subscriptionId: string,
    provider?: string,
  ) => Pick<OpenBillingAuthOptions, 'successUrl' | 'failUrl'>
}

/**
 * - `opened`: 카드 등록 창이 열렸다(대개 이 화면을 떠난다).
 * - `canceled`: 사람이 창을 닫았다 — 오류가 아니다. 시작만 한 구독은 `me` 에 보이지 않고, 다시 누르면 같은 키라 같은 줄이다.
 * - `settled`: 같은 키를 다시 보냈는데 카드를 이미 냈다(`billingAuth: null`) - 열 창이 없다. 화면은 「내 구독」으로 보낸다.
 * - `window-failed`: 창이 못 열렸다(스크립트 차단 · 네트워크 · 서버에 키 없음). 다시 누를 수 있다.
 * - `start-failed`: 서버가 시작을 거절했다(이미 구독 중 · 결제 꺼짐 · 요청이 많음 …).
 */
export type StartSubscribeResult =
  | { kind: 'opened' }
  | { kind: 'canceled' }
  | { kind: 'settled' }
  | { kind: 'window-failed'; error: unknown }
  | { kind: 'start-failed'; error: unknown }

// 토스 SDK 가 창을 닫을 때 던지는 코드(`USER_CANCEL`)와, 실패 주소에 싣는 코드(`PAY_PROCESS_CANCELED`)
const CLOSED_CODES = new Set(['USER_CANCEL', 'PAY_PROCESS_CANCELED'])
const codeOf = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : null

/** 플랜을 골라 「구독하기」를 눌렀을 때 — 서버에 구독을 만들고 카드 등록 창을 연다. 결제사 · 나라는 서버가 정한다(돌아올 주소만 서버가 실제로 쓴 결제사를 따른다) */
export async function startSubscribe(
  deps: StartSubscribeDeps,
  planCode: string,
): Promise<StartSubscribeResult> {
  let started: StartSubscriptionResult
  try {
    started = await deps.start(planCode)
  } catch (error) {
    return { kind: 'start-failed', error }
  }
  if (started.billingAuth === null) return { kind: 'settled' }
  try {
    await deps.openBillingAuth(
      started.billingAuth,
      deps.urlsFor(started.subscription.id, started.billingAuth.provider),
    )
    return { kind: 'opened' }
  } catch (error) {
    const code = codeOf(error)
    if (code !== null && CLOSED_CODES.has(code)) return { kind: 'canceled' }
    return { kind: 'window-failed', error }
  }
}

/** 시작이 거절됐을 때 화면이 말할 것 */
export type StartFailure = 'already' | 'unavailable' | 'rateLimited' | 'failed'

export function startFailureOf(error: unknown): StartFailure {
  if (isErrorCode(error, PaymentLedgerErrorCodes.ALREADY_SUBSCRIBED)) return 'already'
  if (isErrorCode(error, PaymentLedgerErrorCodes.UNAVAILABLE)) return 'unavailable'
  if (isErrorCode(error, ErrorCodes.COMMON_TOO_MANY_REQUESTS)) return 'rateLimited'
  return 'failed'
}

/** 카드 등록 창에서 돌아온 주소가 화면에 시키는 일 */
export type ReturnPlan =
  | { kind: 'activate'; id: string; authKey: string }
  /** 창이 실패 주소로 돌려보냈다. `canceled` 는 사람이 창을 닫은 경우 */
  | { kind: 'left'; canceled: boolean }
  /** Paddle - 첫 결제는 웹훅이 구독을 `ACTIVE` 로 올린다. 서버를 되묻기만 한다 */
  | { kind: 'watch'; id: string }
  | { kind: 'invalid' }

export function returnPlanOf(search: string): ReturnPlan {
  const params = new URLSearchParams(search)
  if (params.get('provider') === 'paddle') {
    const id = params.get('sub')
    return id ? { kind: 'watch', id } : { kind: 'invalid' }
  }
  try {
    const read = readBillingReturn(search)
    if (!read.ok) return { kind: 'left', canceled: CLOSED_CODES.has(read.code) }
    const id = new URLSearchParams(search).get('sub')
    return id ? { kind: 'activate', id, authKey: read.authKey } : { kind: 'invalid' }
  } catch (error) {
    if (error instanceof PaymentRedirectError) return { kind: 'invalid' }
    throw error
  }
}

// 이 탭이 이미 첫 결제를 보낸 (구독, authKey) - 효과가 두 번 돌아도(StrictMode) 뒤로 · 앞으로 가서 이 화면이 다시 떠도 같은 `activate` 를 또 보내지 않는다.
// (백엔드는 재전송을 안전하게 받지만 `authKey` 는 한 번 쓰는 값이다. 새로 고침은 탭의 메모리가 비니 서버의 멱등이 받는다)
const claimed = new Set<string>()

/** 이 (구독, authKey) 의 첫 결제를 지금 보내도 되는가 - 처음 부를 때만 `true` */
export function claimActivation(subscriptionId: string, authKey: string): boolean {
  const key = JSON.stringify([subscriptionId, authKey])
  if (claimed.has(key)) return false
  claimed.add(key)
  return true
}
