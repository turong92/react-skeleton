import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

/*
 * 가짜 네이버페이 — 진짜 네이버페이 없이(인증값이 가맹 심사 뒤에야 나온다) 단건 결제 여정(결제 예약 → 결제창 → 서버 승인 → 조회 → 환불)을 브라우저로 끝까지 돌려 본다. `fakeToss.ts` · `fakeKakaoPay.ts` 와 같은 자리 · 방식이다.
 * 응답 모양은 백엔드의 가짜(`modules/payment-naverpay` 의 시험 소스 `FakeNaverPayServer.kt`)와 맞춘다 - 개발 문서(docs.pay.naver.com) 모양:
 *   POST /naverpay-partner/naverpay/payments/v2/reserve           결제 예약 (JSON) → {code, message, body: {reserveId}}
 *   POST /naverpay-partner/naverpay/payments/v2.2/apply/payment   승인 (폼 paymentId) → {code, message, body: {paymentId, detail}}
 *   POST /naverpay-partner/naverpay/payments/v1/cancel            취소(= 우리 말로 환불) (폼 paymentId, cancelAmount, cancelReason, cancelRequester, taxScopeAmount, taxExScopeAmount) → {code, body: {…RestAmount}}
 *   POST /naverpay-partner/naverpay/payments/v2.3/list/history/{paymentId}   결제 내역 조회 (JSON) → {code, body: {list}}
 * 일부러 진짜처럼 엄격하다: 인증 헤더 셋(`X-Naver-Client-Id` · `X-Naver-Client-Secret` · `X-NaverPay-Chain-Id`) 중 하나라도 틀리면 401 · 예약 · 승인 · 취소는 **멱등 키 헤더가 없으면 400**,
 * 같은 멱등 키의 재요청은 적용하지 않고 409 + 처음 응답 · 예약은 필수 칸이 빠지거나 과세 + 면세가 총액과 다르면 `InvalidParameter` · 이미 승인된 결제의 승인은 `AlreadyComplete` · 남은 금액보다 많은 취소는 `OverRemainAmount` ·
 * 과세 + 면세가 취소 금액과 다르면 `TaxScopeAmountError`. 업무 오류는 HTTP 200 + `code` 로 온다(문서의 결과 코드 표를 그렇게 읽었다 - 백엔드 가짜와 같다).
 *
 * 구매자의 결제창(`GET /payments/<reserveId>`)은 브라우저가 따라가면 곧장 돌아가는 주소(`returnUrl`)로 보낸다 - 진짜 네이버페이 화면에서 구매자가 결제를 마치면 `returnUrl` 에 `resultCode=Success&paymentId=…` 을 붙여 보내는 것과 같다.
 * 결제는 **예약한 값 그대로** 만들어진다(구매자가 금액을 바꿀 길이 없다). 돌아오는 주소(`return-url`)가 이 서버의 `GET /return` 이면 앱 주소(`setApp`)로 한 번 더 넘긴다 - 백엔드는 앱(Vite)보다 먼저 떠서 그 주소를 모르기 때문이다.
 *
 * 제어 `POST /control` — 다음에 일어날 일을 **한 번만** 정한다(앞 시나리오의 지시가 다음 시나리오에 남지 않게):
 *   { buyer: 'cancel' | 'fail' | 'leave' | null }          다음 결제창: 구매자가 그만둔다(UserCancel) · 실패(TimeExpired) · 결제 없이 떠난다(어디로도 돌려보내지 않는다)
 *   { apply: { mode: 'decline'|'delay'|'lose'|'error', delayMs? } | null }   다음 승인: 거절(`Fail`) · 늦게 답함 · 적용했지만 답이 유실됨(연결 끊김) · 5xx(적용 안 됨)
 *   { cancel: { mode: 'not-complete' } | null }             다음 취소: 적용하지 않고 `CancelNotComplete`(취소가 아직 끝나지 않았다 - 곧 자동 재처리)
 *   { reset: true }                                        모든 결제 · 호출 기록 · 지시를 지운다
 * `GET /control` → { payments, reservations, calls, next } — `calls` 는 네이버페이 API(/naverpay-partner/…) 호출만 시각 순으로.
 */

export const FAKE_NAVERPAY = {
  clientId: 'E2EFAKECLIENTID0123456',
  clientSecret: 'E2E_FAKE_CLIENT_SECRET_0123456789abcdef',
  chainId: 'E2EFAKECHAINID01',
}

/** 응답에 일부러 심는 값 - 이 값이 화면 · 우리 API 응답 어디에도 나오면 안 된다(백엔드의 `FakeNaverPayServer.PLANTED` 와 같은 값) */
export const PLANTED = {
  userKey: 'buyer-planted-key',
  cardNo: '5365-****-****-planted',
  userIdentifier: 't1GLYqqJ05planted=',
  product: '초코파이-planted',
}

const API = '/naverpay-partner/naverpay/payments'

type Reservation = { reserveId: string; merchantPayKey: string; total: number; returnUrl: string }

type Cancel = { payHistId: string; amount: number; at: string }

type Payment = {
  paymentId: string
  merchantPayKey: string
  total: number
  applied: boolean
  appliedAt: string | null
  cancels: Cancel[]
}

export type ApplyInstruction = {
  mode: 'decline' | 'delay' | 'lose' | 'error'
  delayMs?: number
}
/** 다음 취소: 취소를 적용하지 않고 `CancelNotComplete`(곧 자동 재처리) · 잔액 부족 같은 거절은 승인에만 있다 */
export type CancelInstruction = { mode: 'not-complete' }
type BuyerInstruction = 'cancel' | 'fail' | 'leave'

export type FakeNaverPayCall = {
  method: string
  path: string
  /** 폼이면 이름 → 값, JSON 이면 그 객체 */
  body: Record<string, unknown> | null
  idempotencyKey: string | null
}
export type FakeNaverPayState = {
  payments: Payment[]
  reservations: Reservation[]
  calls: FakeNaverPayCall[]
  next: {
    buyer: BuyerInstruction | null
    apply: ApplyInstruction | null
    cancel: CancelInstruction | null
  }
}
export type FakeNaverPayPatch = {
  buyer?: BuyerInstruction | null
  apply?: ApplyInstruction | null
  cancel?: CancelInstruction | null
  reset?: boolean
}

export type FakeNaverPay = {
  url: string
  /** 앱(Vite)의 주소 - 구매자가 `GET /return` 에 닿으면 `<앱>/payments/return?…` 으로 넘긴다 */
  setApp: (appUrl: string) => void
  close: () => Promise<void>
}

const ymdt = () =>
  new Date(Date.now() + 9 * 3600_000)
    .toISOString()
    .replace(/[-:T]/g, '')
    .replace(/\.\d+Z$/, '')
const canceledOf = (p: Payment) => p.cancels.reduce((sum, c) => sum + c.amount, 0)
const restOf = (p: Payment) => (p.applied ? p.total - canceledOf(p) : 0)
const histIdOf = (paymentId: string) => `H${paymentId.slice(-12)}`

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => done(data))
  })
}

const parseJson = (text: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(text)
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}
const parseForm = (text: string): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(text))

/** 한 번의 답 - 본문이 있는 것 · 본문 없는 상태 · 연결 끊김(적용한 뒤 답이 유실됨; `replay` 는 같은 멱등 키의 재요청이 받을 처음 응답) */
type Reply =
  | { kind: 'json'; status: number; body: string }
  | { kind: 'empty'; status: number }
  | { kind: 'drop'; replay: string }

const json = (status: number, value: unknown): Reply => ({
  kind: 'json',
  status,
  body: JSON.stringify(value),
})
const envelope = (code: string, message: string, body: unknown = null): Reply =>
  json(200, { code, message, body })
const empty = (status: number): Reply => ({ kind: 'empty', status })

function emit(res: ServerResponse, reply: Reply) {
  if (reply.kind === 'drop') return res.destroy()
  if (reply.kind === 'empty') {
    res.writeHead(reply.status)
    return res.end()
  }
  res.writeHead(reply.status, { 'Content-Type': 'application/json;charset=UTF-8' })
  return res.end(reply.body)
}

export async function startFakeNaverPay(): Promise<FakeNaverPay> {
  const payments = new Map<string, Payment>() // paymentId → 결제
  const replies = new Map<string, string>() // `<operation>/<멱등 키>` → 처음 응답 본문
  let calls: FakeNaverPayCall[] = []
  const reservations = new Map<string, Reservation>()
  const next: FakeNaverPayState['next'] = { buyer: null, apply: null, cancel: null }
  let appUrl = ''
  let sequence = 0

  /** 서버가 결제를 예약한다 - 금액 · 주문 번호는 이 호출의 값이다. */
  function reserve(body: Record<string, unknown> | null): Reply {
    const total = body?.totalPayAmount
    const taxed = body?.taxScopeAmount
    const exempt = body?.taxExScopeAmount
    const items = body?.productItems
    if (
      !body ||
      typeof body.merchantPayKey !== 'string' ||
      !body.merchantPayKey ||
      body.merchantPayKey.length > 64 ||
      typeof body.productName !== 'string' ||
      !Number.isInteger(body.productCount) ||
      !Number.isInteger(total) ||
      (total as number) < 10 ||
      !Number.isInteger(taxed) ||
      !Number.isInteger(exempt) ||
      (taxed as number) + (exempt as number) !== total ||
      typeof body.returnUrl !== 'string' ||
      !body.returnUrl ||
      !Array.isArray(items) ||
      items.length === 0
    )
      return envelope('InvalidParameter', 'reserve')
    const reserveId = `RSV${String(++sequence).padStart(8, '0')}`
    reservations.set(reserveId, {
      reserveId,
      merchantPayKey: body.merchantPayKey,
      total: total as number,
      returnUrl: body.returnUrl,
    })
    return envelope('Success', '', { reserveId })
  }

  /** 구매자의 결제창 - 예약한 값 그대로 결제하고 `returnUrl` 로 돌려보낸다. 어떻게 끝날지는 제어가 정한다 */
  function buyerWindow(res: ServerResponse, reserveId: string) {
    const reservation = reservations.get(reserveId)
    if (!reservation) {
      res.writeHead(404, { 'Content-Type': 'text/plain;charset=UTF-8' })
      return res.end('no such reservation')
    }
    const instruction = next.buyer
    next.buyer = null
    if (instruction === 'leave') {
      res.writeHead(200, { 'Content-Type': 'text/html;charset=UTF-8' })
      return res.end('<!doctype html><title>NaverPay (fake)</title><p>waiting for the buyer</p>')
    }
    const join = reservation.returnUrl.includes('?') ? '&' : '?'
    let query: string
    if (instruction === 'cancel') query = 'resultCode=UserCancel'
    else if (instruction === 'fail')
      query = `resultCode=TimeExpired&resultMessage=failed&reserveId=${reserveId}`
    else {
      const paymentId = `20261017NP${String(++sequence).padStart(8, '0')}`
      payments.set(paymentId, {
        paymentId,
        merchantPayKey: reservation.merchantPayKey,
        total: reservation.total,
        applied: false,
        appliedAt: null,
        cancels: [],
      })
      query = `resultCode=Success&paymentId=${paymentId}`
    }
    res.writeHead(302, { Location: `${reservation.returnUrl}${join}${query}` })
    return res.end()
  }

  function applied(payment: Payment): Reply {
    return envelope('Success', '', {
      paymentId: payment.paymentId,
      detail: {
        paymentId: payment.paymentId,
        payHistId: histIdOf(payment.paymentId),
        merchantName: '가맹점',
        merchantId: 'loginId',
        merchantPayKey: payment.merchantPayKey,
        merchantUserKey: PLANTED.userKey,
        admissionTypeCode: '01',
        admissionYmdt: payment.appliedAt,
        tradeConfirmYmdt: payment.appliedAt,
        admissionState: 'SUCCESS',
        totalPayAmount: payment.total,
        applyPayAmount: payment.total,
        primaryPayAmount: payment.total,
        npointPayAmount: 0,
        giftCardAmount: 0,
        discountPayAmount: 0,
        taxScopeAmount: payment.total,
        taxExScopeAmount: 0,
        environmentDepositAmount: 0,
        primaryPayMeans: 'CARD',
        cardCorpCode: 'C0',
        cardNo: PLANTED.cardNo,
        cardAuthNo: '17545616',
        cardInstCount: 0,
        usedCardPoint: false,
        bankCorpCode: '',
        bankAccountNo: '',
        productName: PLANTED.product,
        settleExpected: false,
        settleExpectAmount: 0,
        payCommissionAmount: 0,
        userIdentifier: PLANTED.userIdentifier,
        extraDeduction: false,
        useCfmYmdt: '20261017',
      },
    })
  }

  async function apply(form: Record<string, string>): Promise<Reply> {
    const payment = payments.get(form.paymentId ?? '')
    if (!payment) return envelope('InvalidMerchant', 'unknown payment')
    const instruction = next.apply
    next.apply = null
    if (instruction?.mode === 'decline') return envelope('Fail', `PG failure ${PLANTED.userKey}`)
    if (instruction?.mode === 'error') return empty(500)
    if (instruction?.mode === 'delay')
      await new Promise((done) => setTimeout(done, instruction.delayMs ?? 12_000))
    if (payment.applied) return envelope('AlreadyComplete', 'already')
    payment.applied = true
    payment.appliedAt = ymdt()
    const reply = applied(payment)
    // 적용했지만 답이 유실됐다 - 같은 멱등 키의 재요청은 처음 응답을 받는다
    return instruction?.mode === 'lose' && reply.kind === 'json'
      ? { kind: 'drop', replay: reply.body }
      : reply
  }

  function cancel(form: Record<string, string>): Reply {
    const instruction = next.cancel
    next.cancel = null
    if (instruction?.mode === 'not-complete') return envelope('CancelNotComplete', 'retry later')
    const payment = payments.get(form.paymentId ?? '')
    if (!payment || !payment.applied) return envelope('InvalidPaymentId', 'not applied')
    const asked = Number(form.cancelAmount)
    const taxed = Number(form.taxScopeAmount)
    const exempt = Number(form.taxExScopeAmount)
    if (
      !Number.isInteger(asked) ||
      !form.cancelReason ||
      !['1', '2'].includes(form.cancelRequester ?? '')
    )
      return envelope('RequireParameter', 'cancel parameters')
    if (!Number.isInteger(taxed) || !Number.isInteger(exempt) || taxed + exempt !== asked)
      return envelope('TaxScopeAmountError', 'tax')
    if (asked <= 0 || asked > restOf(payment))
      return envelope(restOf(payment) === 0 ? 'AlreadyCanceled' : 'OverRemainAmount', 'rest')
    const payHistId = `C${String(++sequence).padStart(13, '0')}`
    payment.cancels.push({ payHistId, amount: asked, at: ymdt() })
    const rest = restOf(payment)
    return envelope('Success', '', {
      paymentId: payment.paymentId,
      payHistId,
      primaryPayMeans: 'CARD',
      primaryPayCancelAmount: asked,
      primaryPayRestAmount: rest,
      npointCancelAmount: 0,
      npointRestAmount: 0,
      giftCardCancelAmount: 0,
      giftCardRestAmount: 0,
      discountCancelAmount: 0,
      discountRestAmount: 0,
      taxScopeAmount: asked,
      taxExScopeAmount: 0,
      taxScopeRestAmount: rest,
      taxExScopeRestAmount: 0,
      environmentDepositAmount: 0,
      environmentDepositRestAmount: 0,
      cancelYmdt: ymdt(),
      totalRestAmount: rest,
      applyRestAmount: rest,
    })
  }

  function history(paymentId: string): Reply {
    const payment = payments.get(paymentId)
    const entry = (histId: string, type: string, amount: number, at: string) => ({
      paymentId,
      payHistId: histId,
      admissionState: 'SUCCESS',
      admissionTypeCode: type,
      admissionYmdt: at,
      tradeConfirmYmdt: at,
      totalPayAmount: amount,
      applyPayAmount: amount,
      primaryPayAmount: amount,
      merchantPayKey: payment?.merchantPayKey,
      merchantUserKey: PLANTED.userKey,
      primaryPayMeans: 'CARD',
      cardNo: PLANTED.cardNo,
      productName: PLANTED.product,
      settleInfo: { settleCreated: false },
    })
    const list = payment
      ? [
          ...(payment.applied
            ? [entry(histIdOf(paymentId), '01', payment.total, payment.appliedAt ?? '')]
            : []),
          ...payment.cancels.map((c) =>
            entry(c.payHistId, c.amount === payment.total ? '03' : '04', c.amount, c.at),
          ),
        ]
      : []
    return envelope('Success', '', {
      list,
      totalCount: list.length,
      responseCount: list.length,
      totalPageCount: list.length === 0 ? 0 : 1,
      currentPageNumber: 1,
    })
  }

  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const requestUrl = new URL(req.url ?? '/', 'http://fake')
    const path = requestUrl.pathname
    try {
      // 제어
      if (path === '/control') {
        if (req.method === 'GET')
          return emit(
            res,
            json(200, {
              payments: [...payments.values()],
              reservations: [...reservations.values()],
              calls,
              next,
            } satisfies FakeNaverPayState),
          )
        const patch = (parseJson(await readBody(req)) ?? {}) as FakeNaverPayPatch
        if (patch.reset) {
          payments.clear()
          replies.clear()
          reservations.clear()
          calls = []
          next.buyer = null
          next.apply = null
          next.cancel = null
        }
        if ('buyer' in patch) next.buyer = patch.buyer ?? null
        if ('apply' in patch) next.apply = patch.apply ?? null
        if ('cancel' in patch) next.cancel = patch.cancel ?? null
        return emit(res, json(200, { ok: true }))
      }

      // 구매자의 결제창 · 돌아가는 길
      const window = /^\/payments\/([^/]+)$/.exec(path)
      if (req.method === 'GET' && window) return buyerWindow(res, window[1] ?? '')
      if (req.method === 'GET' && path === '/return') {
        if (!appUrl) return emit(res, empty(500))
        res.writeHead(302, { Location: `${appUrl}/payments/return${requestUrl.search}` })
        return res.end()
      }

      // 네이버페이 API
      if (!path.startsWith(`${API}/`)) return emit(res, empty(404))
      const raw = await readBody(req)
      const operation = path.endsWith('/v2/reserve')
        ? 'reserve'
        : path.endsWith('/apply/payment')
          ? 'apply'
          : path.endsWith('/v1/cancel')
            ? 'cancel'
            : path.includes('/list/history/')
              ? 'history'
              : null
      const key = (req.headers['x-naverpay-idempotency-key'] as string | undefined) ?? null
      calls.push({
        method: req.method ?? 'GET',
        path,
        body: operation === 'history' || operation === 'reserve' ? parseJson(raw) : parseForm(raw),
        idempotencyKey: key,
      })
      if (
        req.headers['x-naver-client-id'] !== FAKE_NAVERPAY.clientId ||
        req.headers['x-naver-client-secret'] !== FAKE_NAVERPAY.clientSecret ||
        req.headers['x-naverpay-chain-id'] !== FAKE_NAVERPAY.chainId
      )
        return emit(res, empty(401))
      if (!operation || req.method !== 'POST') return emit(res, empty(404))
      if (operation === 'history')
        return emit(res, history(decodeURIComponent(path.split('/').at(-1) ?? '')))
      // 승인 · 취소는 폼 + 멱등 키 - 같은 키의 재요청은 적용하지 않고 처음 응답을 409 로 돌려준다
      if (!key || key.length > 64 || !/^[A-Za-z0-9_-]+$/.test(key)) return emit(res, empty(400))
      const replay = replies.get(`${operation}/${key}`)
      if (replay !== undefined) return emit(res, { kind: 'json', status: 409, body: replay })
      const reply =
        operation === 'reserve'
          ? reserve(parseJson(raw))
          : operation === 'apply'
            ? await apply(parseForm(raw))
            : cancel(parseForm(raw))
      if (reply.kind === 'drop') replies.set(`${operation}/${key}`, reply.replay)
      else if (
        reply.kind === 'json' &&
        reply.status === 200 &&
        JSON.parse(reply.body).code === 'Success'
      )
        replies.set(`${operation}/${key}`, reply.body)
      return emit(res, reply)
    } catch {
      if (!res.headersSent) emit(res, empty(500))
    }
  }

  const server: Server = createServer((req, res) => void handler(req, res))
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  const url = `http://127.0.0.1:${port}`
  return {
    url,
    setApp: (value) => {
      appUrl = value.replace(/\/+$/, '')
    },
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections()
        server.close(() => done())
      }),
  }
}

/** 시험이 가짜 네이버페이를 제어한다 - `GET /control` 로 결제와 호출 기록을 읽는다 */
export function naverPayControl(url: string) {
  const post = (patch: FakeNaverPayPatch) =>
    fetch(`${url}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  return {
    set: async (patch: FakeNaverPayPatch) => {
      await post(patch)
    },
    state: async () => (await (await fetch(`${url}/control`)).json()) as FakeNaverPayState,
  }
}
