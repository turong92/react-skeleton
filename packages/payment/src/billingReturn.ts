import { PaymentRedirectError } from './tossRedirect'

export type BillingReturn =
  /** 토스 - `customerKey` 는 돌려주지 않는다. 서버가 이미 안다 */
  | { ok: true; authKey: string }
  /** 카카오페이(`pg_token`) · 네이버페이(`reserveId` + `tempReceiptId`) - 그대로 `activate` 의 `providerPayload` 로 보낸다 */
  | {
      ok: true
      providerPayload: { pg_token: string } | { reserveId: string; tempReceiptId: string }
    }
  /** 결제사가 준 `message` 는 일부러 돌려주지 않는다 — 화면은 `code` 로 우리 문구를 고른다 */
  | { ok: false; code: string }

/**
 * 카드 등록 창이 `successUrl` / `failUrl` 로 돌려보낸 주소(`?authKey&customerKey` / `?code&message`)를 읽는다.
 * `authKey` 가 있으면 성공 쪽이다. 어느 쪽도 아니면 `PaymentRedirectError`.
 * 카카오페이 · 네이버페이는 서버가 정한 주소로 돌아오고 `kind` 로 갈린다: `kind=KAKAOPAY_BILLING_REDIRECT&result=success&pg_token=…` / `result=cancel|fail`,
 * `kind=NAVERPAY_BILLING_REDIRECT&resultCode=Success&reserveId=…&tempReceiptId=…` / `resultCode=UserCancel` / 그 밖의 `resultCode`(결제사 글 `resultMessage` 는 읽지 않는다).
 */
export function readBillingReturn(search: string | URLSearchParams): BillingReturn {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const kind = params.get('kind')
  if (kind === 'KAKAOPAY_BILLING_REDIRECT') {
    switch (params.get('result')) {
      case 'success': {
        const token = params.get('pg_token')
        if (!token) throw new PaymentRedirectError('The billing redirect has no pg_token')
        return { ok: true, providerPayload: { pg_token: token } }
      }
      case 'cancel':
        return { ok: false, code: 'CANCELED' }
      case 'fail':
        return { ok: false, code: 'FAILED' }
      default:
        throw new PaymentRedirectError('The billing redirect has no known result')
    }
  }
  if (kind === 'NAVERPAY_BILLING_REDIRECT') {
    const resultCode = params.get('resultCode')
    if (!resultCode) throw new PaymentRedirectError('The billing redirect has no resultCode')
    if (resultCode === 'Success') {
      const reserveId = params.get('reserveId')
      const tempReceiptId = params.get('tempReceiptId')
      if (!reserveId || !tempReceiptId)
        throw new PaymentRedirectError('The billing redirect has no reserveId or tempReceiptId')
      return { ok: true, providerPayload: { reserveId, tempReceiptId } }
    }
    return { ok: false, code: resultCode === 'UserCancel' ? 'CANCELED' : 'FAILED' }
  }
  const authKey = params.get('authKey')
  if (authKey) return { ok: true, authKey }
  const code = params.get('code')
  if (code) return { ok: false, code }
  throw new PaymentRedirectError('The billing redirect has neither authKey nor code')
}
