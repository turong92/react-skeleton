import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

/*
 * 가짜 네이버페이 — 진짜 네이버페이 없이(인증값이 가맹 심사 뒤에야 나온다) 단건 결제 여정(결제 예약 → 결제창 → 서버 승인 → 조회 → 환불)을 브라우저로 끝까지 돌려 본다. `fakeToss.ts` · `fakeKakaoPay.ts` 와 같은 자리 · 방식이다.
 * 응답 모양은 백엔드의 가짜(`modules/payment-naverpay` 의 시험 소스 `FakeNaverPayServer.kt`)와 맞춘다 - 개발 문서(docs.pay.naver.com) 모양:
 *   POST /naverpay-partner/naverpay/payments/v2/reserve           결제 예약 (JSON) → {code, message, body: {reserveId}}
 *   POST /naverpay-partner/naverpay/payments/v2.2/apply/payment   승인 (폼 paymentId) → {code, message, body: {paymentId, detail}}
 *   POST /naverpay-partner/naverpay/payments/v1/cancel            취소(= 우리 말로 환불) (폼 paymentId, cancelAmount, cancelReason, cancelRequester, taxScopeAmount, taxExScopeAmount) → {code, body: {…RestAmount}}
 *   POST /naverpay-partner/naverpay/payments/v2.3/list/history/{paymentId}   결제 내역 조회 (JSON) → {code, body: {list}}
 * 정기 결제(자동결제) - 인증값이 단건과 **다르다**(`FAKE_NAVERPAY.recurrent`; 정기 호출에 단건 값은 401, 단건 호출에 정기 값도 401):
 *   POST …/recurrent/regist/v1/reserve   등록 예약 (JSON productCode, productName, totalPayAmount, returnUrl, merchantUserId) → {reserveId} · 같은 productCode 로 활성 등록이 있으면 `DataExist`
 *   POST …/recurrent/regist/v1/approval  등록 완료 (JSON reserveId, tempReceiptId) → {recurrentId, 가려진 이메일}  ← 돈이 움직이지 않는다
 *   POST …/recurrent/pay/v3/reserve      자동결제 예약 (JSON recurrentId, totalPayAmount, taxScopeAmount, taxExScopeAmount, productName, merchantPayId, merchantUserId) → {paymentId}
 *   POST …/recurrent/pay/v3/approval     자동결제 승인 (JSON paymentId) → 단건 승인과 같은 {paymentId, detail}
 *   POST …/recurrent/expire/v1/request   등록 해지 (JSON recurrentId, expireRequester, expireReason) · 이미 해지면 `Expired`
 * 정기 결제의 취소 · 결제 내역 조회는 단건과 같은 경로이고 그 결제가 정기면 정기 인증값이어야 한다. 구매자의 등록창(`GET /payments/recurrent/<reserveId>`)은 `returnUrl` 로
 * `resultCode=Success&reserveId=…&tempReceiptId=…` 을 붙여 돌려보낸다(`UserCancel` 은 제어). 정기 등록으로 돌아오는 주소(`kind=NAVERPAY_BILLING_REDIRECT`)는 앱의 `/subscriptions/return` 으로 넘긴다.
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
 *   { payApproval: { mode: 'decline'|'lose'|'error' } | null }   다음 자동결제 승인: 거절(`Fail` - 모름) · 적용했지만 답이 유실됨 · 5xx(적용 안 됨) · { mode: 'balance' } 잔액 부족(확정 거절)
 *   { reset: true }                                        모든 결제 · 호출 기록 · 지시를 지운다
 * `GET /control` → { payments, reservations, recurrents, calls, next } — `calls` 는 네이버페이 API(/naverpay-partner/…) 호출만 시각 순으로.
 */

export const FAKE_NAVERPAY = {
  clientId: 'E2EFAKECLIENTID0123456',
  clientSecret: 'E2E_FAKE_CLIENT_SECRET_0123456789abcdef',
  chainId: 'E2EFAKECHAINID01',
  /** 정기 결제(자동결제)의 인증값 - 단건과 다르다 */
  recurrent: {
    clientId: 'E2EFAKERECURCLIENT012',
    clientSecret: 'E2E_FAKE_RECUR_SECRET_0123456789abcdef',
    chainId: 'E2EFAKERECURCHAIN',
  },
}

/** 응답에 일부러 심는 값 - 이 값이 화면 · 우리 API 응답 어디에도 나오면 안 된다(백엔드의 `FakeNaverPayServer.PLANTED` 와 같은 값) */
export const PLANTED = {
  userKey: 'buyer-planted-key',
  cardNo: '5365-****-****-planted',
  userIdentifier: 't1GLYqqJ05planted=',
  product: '초코파이-planted',
  email: 'pl***@example.com',
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
  /** 정기 결제(자동결제)로 만들어진 결제 - 취소 · 내역 조회가 정기 인증값을 요구한다 */
  recurring?: boolean
}

/** 정기 등록 예약 - 구매자가 창에서 마치면 `tempReceiptId` 가 생기고 등록 완료가 `recurrentId` 를 준다 */
type RegistReservation = {
  reserveId: string
  productCode: string
  merchantUserId: string
  returnUrl: string
  tempReceiptId: string | null
  recurrentId: string | null
}

type Recurrent = { recurrentId: string; productCode: string; active: boolean }

/** 자동결제 예약(승인 전) */
type PayReservation = {
  paymentId: string
  recurrentId: string
  merchantPayKey: string
  total: number
  approved: boolean
}

export type ApplyInstruction = {
  mode: 'decline' | 'delay' | 'lose' | 'error'
  delayMs?: number
}
export type PayApprovalInstruction = { mode: 'decline' | 'lose' | 'error' | 'balance' }
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
  registReservations: RegistReservation[]
  /** recurrentId → 활성 여부 */
  recurrents: Record<string, boolean>
  payReservations: PayReservation[]
  calls: FakeNaverPayCall[]
  next: {
    buyer: BuyerInstruction | null
    apply: ApplyInstruction | null
    cancel: CancelInstruction | null
    payApproval: PayApprovalInstruction | null
  }
}
export type FakeNaverPayPatch = {
  buyer?: BuyerInstruction | null
  apply?: ApplyInstruction | null
  cancel?: CancelInstruction | null
  payApproval?: PayApprovalInstruction | null
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
  const registReservations = new Map<string, RegistReservation>()
  const recurrents = new Map<string, Recurrent>()
  const payReservations = new Map<string, PayReservation>()
  const next: FakeNaverPayState['next'] = {
    buyer: null,
    apply: null,
    cancel: null,
    payApproval: null,
  }
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

  const text = (body: Record<string, unknown> | null, name: string) =>
    typeof body?.[name] === 'string' ? (body[name] as string) : ''

  /** 등록 예약: 같은 `productCode` 로 이미 활성 등록이 있으면 `DataExist`(문서의 「중복 등록 불가」) */
  function registReserve(body: Record<string, unknown> | null): Reply {
    const code = text(body, 'productCode')
    const total = body?.totalPayAmount
    if (
      !code ||
      !text(body, 'merchantUserId') ||
      !text(body, 'returnUrl') ||
      !text(body, 'productName') ||
      !Number.isInteger(total) ||
      (total as number) < 10
    )
      return envelope('InvalidParameter', 'regist')
    if ([...recurrents.values()].some((r) => r.productCode === code && r.active))
      return envelope('DataExist', 'registered')
    const reserveId = `RGR${String(++sequence).padStart(8, '0')}`
    registReservations.set(reserveId, {
      reserveId,
      productCode: code,
      merchantUserId: text(body, 'merchantUserId'),
      returnUrl: text(body, 'returnUrl'),
      tempReceiptId: null,
      recurrentId: null,
    })
    return envelope('Success', '', { reserveId })
  }

  /** 등록 완료 - 구매자가 창에서 마친 예약의 영수증이어야 하고 한 번만. 응답에 가려진 이메일을 심는다(저장 · 로그 금지) */
  function registApproval(body: Record<string, unknown> | null): Reply {
    const reservation = registReservations.get(text(body, 'reserveId'))
    if (
      !reservation ||
      !reservation.tempReceiptId ||
      reservation.tempReceiptId !== text(body, 'tempReceiptId') ||
      reservation.recurrentId
    )
      return envelope('InvalidParameter', 'receipt')
    const recurrentId = `RC${String(++sequence).padStart(10, '0')}`
    reservation.recurrentId = recurrentId
    recurrents.set(recurrentId, { recurrentId, productCode: reservation.productCode, active: true })
    return envelope('Success', '', {
      recurrentId,
      email: PLANTED.email,
      userIdentifier: PLANTED.userIdentifier,
    })
  }

  function payReserve(body: Record<string, unknown> | null): Reply {
    const recurrent = recurrents.get(text(body, 'recurrentId'))
    if (!recurrent?.active) return envelope('InvalidRecurrentId', 'unknown')
    const total = body?.totalPayAmount
    const taxed = body?.taxScopeAmount
    const exempt = body?.taxExScopeAmount
    const key = text(body, 'merchantPayId')
    if (
      !Number.isInteger(total) ||
      (total as number) < 10 ||
      !Number.isInteger(taxed) ||
      !Number.isInteger(exempt) ||
      (taxed as number) + (exempt as number) !== total ||
      !key ||
      key.length > 64 ||
      !text(body, 'productName') ||
      !text(body, 'merchantUserId')
    )
      return envelope('InvalidParameter', 'pay')
    const paymentId = `20261117NR${String(++sequence).padStart(8, '0')}`
    payReservations.set(paymentId, {
      paymentId,
      recurrentId: recurrent.recurrentId,
      merchantPayKey: key,
      total: total as number,
      approved: false,
    })
    return envelope('Success', '', { paymentId })
  }

  async function payApproval(body: Record<string, unknown> | null): Promise<Reply> {
    const reservation = payReservations.get(text(body, 'paymentId'))
    if (!reservation) return envelope('InvalidMerchant', 'unknown payment')
    const instruction = next.payApproval
    next.payApproval = null
    if (instruction?.mode === 'decline') return envelope('Fail', `PG failure ${PLANTED.userKey}`)
    if (instruction?.mode === 'balance') return envelope('NotEnoughAccountBalance', 'balance')
    if (instruction?.mode === 'error') return empty(500)
    if (reservation.approved) return envelope('AlreadyComplete', 'already')
    if (!recurrents.get(reservation.recurrentId)?.active)
      return envelope('InvalidRecurrentId', 'expired')
    reservation.approved = true
    const payment: Payment = {
      paymentId: reservation.paymentId,
      merchantPayKey: reservation.merchantPayKey,
      total: reservation.total,
      applied: true,
      appliedAt: ymdt(),
      cancels: [],
      recurring: true,
    }
    payments.set(payment.paymentId, payment)
    const reply = applied(payment)
    // 적용했지만 답이 유실됐다 - 같은 멱등 키의 재요청은 처음 응답을 받는다
    return instruction?.mode === 'lose' && reply.kind === 'json'
      ? { kind: 'drop', replay: reply.body }
      : reply
  }

  /** 등록 해지: 이미 해지된 등록은 `Expired`(정상으로 읽어야 한다) */
  function expire(body: Record<string, unknown> | null): Reply {
    const recurrent = recurrents.get(text(body, 'recurrentId'))
    if (!recurrent) return envelope('InvalidRecurrentId', 'unknown')
    if (!text(body, 'expireRequester') || !text(body, 'expireReason'))
      return envelope('RequireParameter', 'expire')
    if (!recurrent.active) return envelope('Expired', 'already')
    recurrent.active = false
    return envelope('Success', '')
  }

  /** 구매자의 등록창 - 등록을 마치고 `returnUrl` 로 돌려보낸다. 어떻게 끝날지는 제어가 정한다 */
  function registrationWindow(res: ServerResponse, reserveId: string) {
    const reservation = registReservations.get(reserveId)
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
      reservation.tempReceiptId = `TR${String(++sequence).padStart(8, '0')}`
      query = `resultCode=Success&reserveId=${reserveId}&tempReceiptId=${reservation.tempReceiptId}`
    }
    res.writeHead(302, { Location: `${reservation.returnUrl}${join}${query}` })
    return res.end()
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
              registReservations: [...registReservations.values()],
              recurrents: Object.fromEntries([...recurrents].map(([id, r]) => [id, r.active])),
              payReservations: [...payReservations.values()],
              calls,
              next,
            } satisfies FakeNaverPayState),
          )
        const patch = (parseJson(await readBody(req)) ?? {}) as FakeNaverPayPatch
        if (patch.reset) {
          payments.clear()
          replies.clear()
          reservations.clear()
          registReservations.clear()
          recurrents.clear()
          payReservations.clear()
          calls = []
          next.buyer = null
          next.apply = null
          next.cancel = null
          next.payApproval = null
        }
        if ('buyer' in patch) next.buyer = patch.buyer ?? null
        if ('apply' in patch) next.apply = patch.apply ?? null
        if ('cancel' in patch) next.cancel = patch.cancel ?? null
        if ('payApproval' in patch) next.payApproval = patch.payApproval ?? null
        return emit(res, json(200, { ok: true }))
      }

      // 구매자의 결제창 · 돌아가는 길
      const registration = /^\/payments\/recurrent\/([^/]+)$/.exec(path)
      if (req.method === 'GET' && registration)
        return registrationWindow(res, registration[1] ?? '')
      const window = /^\/payments\/([^/]+)$/.exec(path)
      if (req.method === 'GET' && window) return buyerWindow(res, window[1] ?? '')
      if (req.method === 'GET' && path === '/return') {
        if (!appUrl) return emit(res, empty(500))
        // 정기 등록으로 돌아오는 주소는 구독 돌아오기 화면으로, 단건은 결제 돌아오기 화면으로
        const billing = requestUrl.searchParams.get('kind') === 'NAVERPAY_BILLING_REDIRECT'
        res.writeHead(302, {
          Location: `${appUrl}/${billing ? 'subscriptions' : 'payments'}/return${requestUrl.search}`,
        })
        return res.end()
      }

      // 네이버페이 API
      if (!path.startsWith(`${API}/`)) return emit(res, empty(404))
      const raw = await readBody(req)
      const recurrentOperation = path.endsWith('/recurrent/regist/v1/reserve')
        ? 'regist-reserve'
        : path.endsWith('/recurrent/regist/v1/approval')
          ? 'regist-approval'
          : path.endsWith('/recurrent/pay/v3/reserve')
            ? 'pay-reserve'
            : path.endsWith('/recurrent/pay/v3/approval')
              ? 'pay-approval'
              : path.endsWith('/recurrent/expire/v1/request')
                ? 'expire'
                : null
      const operation =
        recurrentOperation ??
        (path.endsWith('/v2/reserve')
          ? 'reserve'
          : path.endsWith('/apply/payment')
            ? 'apply'
            : path.endsWith('/v1/cancel')
              ? 'cancel'
              : path.includes('/list/history/')
                ? 'history'
                : null)
      const key = (req.headers['x-naverpay-idempotency-key'] as string | undefined) ?? null
      calls.push({
        method: req.method ?? 'GET',
        path,
        body:
          operation === 'history' || operation === 'reserve' || recurrentOperation
            ? parseJson(raw)
            : parseForm(raw),
        idempotencyKey: key,
      })
      // 인증값: 정기 호출은 정기 값, 단건 호출은 단건 값 - 취소 · 내역 조회는 그 결제가 정기인지에 따라 갈린다
      const sent = [
        req.headers['x-naver-client-id'],
        req.headers['x-naver-client-secret'],
        req.headers['x-naverpay-chain-id'],
      ]
      const single = [FAKE_NAVERPAY.clientId, FAKE_NAVERPAY.clientSecret, FAKE_NAVERPAY.chainId]
      const recurrent = [
        FAKE_NAVERPAY.recurrent.clientId,
        FAKE_NAVERPAY.recurrent.clientSecret,
        FAKE_NAVERPAY.recurrent.chainId,
      ]
      const touched =
        operation === 'history'
          ? decodeURIComponent(path.split('/').at(-1) ?? '')
          : parseForm(raw).paymentId
      const wantRecurrent =
        recurrentOperation !== null ||
        ((operation === 'cancel' || operation === 'history') &&
          payments.get(touched ?? '')?.recurring === true)
      if (!(wantRecurrent ? recurrent : single).every((value, i) => sent[i] === value))
        return emit(res, empty(401))
      if (!operation || req.method !== 'POST') return emit(res, empty(404))
      if (operation === 'history')
        return emit(res, history(decodeURIComponent(path.split('/').at(-1) ?? '')))
      // 승인 · 취소는 폼 + 멱등 키 - 같은 키의 재요청은 적용하지 않고 처음 응답을 409 로 돌려준다
      if (!key || key.length > 64 || !/^[A-Za-z0-9_-]+$/.test(key)) return emit(res, empty(400))
      const replay = replies.get(`${operation}/${key}`)
      if (replay !== undefined) return emit(res, { kind: 'json', status: 409, body: replay })
      const reply =
        operation === 'regist-reserve'
          ? registReserve(parseJson(raw))
          : operation === 'regist-approval'
            ? registApproval(parseJson(raw))
            : operation === 'pay-reserve'
              ? payReserve(parseJson(raw))
              : operation === 'pay-approval'
                ? await payApproval(parseJson(raw))
                : operation === 'expire'
                  ? expire(parseJson(raw))
                  : operation === 'reserve'
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
