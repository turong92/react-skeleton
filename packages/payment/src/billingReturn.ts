import { PaymentRedirectError } from './tossRedirect'

export type BillingReturn =
  /** `customerKey` 는 돌려주지 않는다 — 서버가 이미 안다 */
  | { ok: true; authKey: string }
  /** 결제사가 준 `message` 는 일부러 돌려주지 않는다 — 화면은 `code` 로 우리 문구를 고른다 */
  | { ok: false; code: string }

/**
 * 카드 등록 창이 `successUrl` / `failUrl` 로 돌려보낸 주소(`?authKey&customerKey` / `?code&message`)를 읽는다.
 * `authKey` 가 있으면 성공 쪽이다. 어느 쪽도 아니면 `PaymentRedirectError`.
 */
export function readBillingReturn(search: string | URLSearchParams): BillingReturn {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const authKey = params.get('authKey')
  if (authKey) return { ok: true, authKey }
  const code = params.get('code')
  if (code) return { ok: false, code }
  throw new PaymentRedirectError('The billing redirect has neither authKey nor code')
}
