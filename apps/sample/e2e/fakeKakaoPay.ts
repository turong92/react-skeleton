import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'

/*
 * 가짜 카카오페이 — 진짜 카카오페이 없이 단건 결제 여정(결제 준비 → 구매자 인증 → 서버 승인 → 조회 → 환불)을 브라우저로 끝까지 돌려 본다. `fakeToss.ts` 와 같은 자리 · 방식이다.
 * 응답 모양은 백엔드의 가짜(`modules/payment-kakaopay` 의 시험 소스 `FakeKakaoPayServer.kt`)와 맞춘다 — 개발자센터 문서 모양의 JSON:
 *   POST /online/v1/payment/ready     결제 준비 {cid, partner_order_id, partner_user_id, item_name, quantity, total_amount, tax_free_amount, approval_url, cancel_url, fail_url} → {tid, next_redirect_*_url}
 *   POST /online/v1/payment/approve   승인 {cid, tid, partner_order_id, partner_user_id, pg_token, total_amount?} → 승인 객체 · 거절 400 -780
 *   POST /online/v1/payment/cancel    취소(= 우리 말로 환불) {cid, tid, cancel_amount, cancel_tax_free_amount} → 취소 객체(PART_CANCEL_PAYMENT · CANCEL_PAYMENT) · 거절 400 -781
 *   POST /online/v1/payment/order     주문 조회 {cid, tid} → status · payment_action_details
 * 일부러 진짜처럼 엄격하다: `Authorization: SECRET_KEY <키>` 가 틀리면 401 -401 · 가맹점 코드(cid)가 다르면 400 -400 · 필수 칸이 빠지면 400 -400 ·
 * 승인은 구매자가 인증을 마친 결제의 pg_token 이어야 하고 주문 번호 · 회원 id 가 준비 때와 같아야 하며 **총액이 준비 때와 다르면 거절**, 이미 승인된 결제의 승인은 거절 ·
 * 남은 취소 가능 금액보다 많은 취소는 거절.
 *
 * 구매자의 결제창(`next_redirect_*_url` = 이 서버의 `GET /pay/<tid>/…`)은 브라우저가 따라가면 곧장 돌아가는 주소로 보낸다 - 진짜 카카오페이 화면에서 구매자가 인증을 마치면 `approval_url` 에
 * `pg_token` 을 붙여 돌려보내는 것과 같다. 어디로 돌려보낼지는 제어(`buyer`)가 정한다. 돌려보내는 주소(`return-url`)가 이 서버의 `GET /return` 이면 앱 주소(`setApp`)로 한 번 더 넘긴다 —
 * 백엔드는 앱(Vite)보다 먼저 떠서 그 주소를 모르기 때문이다.
 *
 * 제어 `POST /control` — 다음에 일어날 일을 **한 번만** 정한다(앞 시나리오의 지시가 다음 시나리오에 남지 않게):
 *   { buyer: 'cancel' | 'fail' | 'leave' | null }          다음 결제창: 구매자가 그만둔다(cancel_url) · 결제 실패 화면(fail_url) · 인증 없이 떠난다(어디로도 돌려보내지 않는다)
 *   { approve: { mode: 'decline'|'delay'|'lose'|'error', delayMs? } | null }   다음 승인: 거절 · 늦게 답함 · 적용했지만 답이 유실됨(연결 끊김) · 5xx(적용 안 됨)
 *   { reset: true }                                        모든 결제 · 호출 기록 · 지시를 지운다
 * `GET /control` → { payments, calls, next } — `calls` 는 카카오페이 API(/online/…) 호출만 시각 순으로, 본문과 함께(승인 토큰은 가린다).
 */

export const FAKE_KAKAOPAY = {
  secretKey: 'DEV_FAKE_E2E_SECRET_KEY_0123456789abcdef',
  cid: 'TC0ONETIME',
}

/** 응답에 일부러 심는 값 - 이 값이 화면 · 우리 API 응답 어디에도 나오면 안 된다(백엔드의 `FakeKakaoPayServer.PLANTED` 와 같은 값) */
export const PLANTED = {
  name: '홍길동',
  cardBin: '621640',
  issuer: '수협은행',
  item: '초코파이-planted',
}

type Cancel = { aid: string; amount: number; at: string }

type Payment = {
  tid: string
  partnerOrderId: string
  partnerUserId: string
  total: number
  itemName: string
  approvalUrl: string
  cancelUrl: string
  failUrl: string
  status:
    | 'READY'
    | 'AUTH_PASSWORD'
    | 'SUCCESS_PAYMENT'
    | 'PART_CANCEL_PAYMENT'
    | 'CANCEL_PAYMENT'
    | 'QUIT_PAYMENT'
    | 'FAIL_PAYMENT'
  pgToken: string | null
  approvedAt: string | null
  cancels: Cancel[]
}

export type ApproveInstruction = {
  mode: 'decline' | 'delay' | 'lose' | 'error'
  delayMs?: number
}
type BuyerInstruction = 'cancel' | 'fail' | 'leave'

export type FakeKakaoPayCall = {
  method: string
  path: string
  body: Record<string, unknown> | null
}
export type FakeKakaoPayState = {
  payments: Payment[]
  calls: FakeKakaoPayCall[]
  next: { buyer: BuyerInstruction | null; approve: ApproveInstruction | null }
}
export type FakeKakaoPayPatch = {
  buyer?: BuyerInstruction | null
  approve?: ApproveInstruction | null
  reset?: boolean
}

export type FakeKakaoPay = {
  url: string
  /** 앱(Vite)의 주소 - 구매자가 `GET /return` 에 닿으면 `<앱>/payments/return?…` 으로 넘긴다 */
  setApp: (appUrl: string) => void
  close: () => Promise<void>
}

const kst = () => new Date(Date.now() + 9 * 3600_000).toISOString().replace(/\.\d+Z$/, '')

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => done(data))
  })
}

const parse = (text: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(text)
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const send = (res: ServerResponse, status: number, value: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json;charset=UTF-8' })
  res.end(JSON.stringify(value))
}
const kakaoError = (
  res: ServerResponse,
  status: number,
  code: number,
  message: string,
  methodResult?: string,
) =>
  send(res, status, {
    error_code: code,
    error_message: `${message} ${PLANTED.name}`,
    ...(methodResult
      ? {
          extras: { method_result_code: methodResult, method_result_message: `${PLANTED.name} 님` },
        }
      : {}),
  })

const amountObject = (total: number) => ({
  total,
  tax_free: 0,
  vat: Math.floor(total / 11),
  point: 0,
  discount: 0,
  green_deposit: 0,
})
const canceledOf = (p: Payment) => p.cancels.reduce((sum, c) => sum + c.amount, 0)
const availableOf = (p: Payment) =>
  p.status === 'SUCCESS_PAYMENT' || p.status === 'PART_CANCEL_PAYMENT' ? p.total - canceledOf(p) : 0
const aidOf = (tid: string) => `A${tid.slice(-19)}`

/** 우리 API(`/online/…`)가 받는 본문에서 비밀(승인 토큰)을 가린 사본 - 호출 기록에 남긴다 */
const redacted = (body: Record<string, unknown> | null) =>
  body && 'pg_token' in body ? { ...body, pg_token: '<redacted>' } : body

export async function startFakeKakaoPay(): Promise<FakeKakaoPay> {
  const payments = new Map<string, Payment>() // tid → 결제
  let calls: FakeKakaoPayCall[] = []
  const next: FakeKakaoPayState['next'] = { buyer: null, approve: null }
  let appUrl = ''
  let sequence = 0

  const withToken = (url: string, token: string) =>
    `${url}${url.includes('?') ? '&' : '?'}pg_token=${encodeURIComponent(token)}`

  function ready(res: ServerResponse, body: Record<string, unknown>) {
    const text = (name: string) => (typeof body[name] === 'string' ? (body[name] as string) : '')
    const total = body.total_amount
    if (
      [
        'partner_order_id',
        'partner_user_id',
        'item_name',
        'approval_url',
        'cancel_url',
        'fail_url',
      ].some((name) => !text(name)) ||
      !Number.isInteger(total) ||
      (total as number) <= 0 ||
      !Number.isInteger(body.quantity) ||
      !Number.isInteger(body.tax_free_amount)
    )
      return kakaoError(res, 400, -400, 'missing field')
    const tid = `T${String(++sequence).padStart(19, '0')}`
    payments.set(tid, {
      tid,
      partnerOrderId: text('partner_order_id'),
      partnerUserId: text('partner_user_id'),
      total: total as number,
      itemName: text('item_name'),
      approvalUrl: text('approval_url'),
      cancelUrl: text('cancel_url'),
      failUrl: text('fail_url'),
      status: 'READY',
      pgToken: null,
      approvedAt: null,
      cancels: [],
    })
    return send(res, 200, {
      tid,
      next_redirect_app_url: `${url}/pay/${tid}/aInfo`,
      next_redirect_mobile_url: `${url}/pay/${tid}/mInfo`,
      next_redirect_pc_url: `${url}/pay/${tid}/info`,
      created_at: kst(),
    })
  }

  async function approve(res: ServerResponse, body: Record<string, unknown>) {
    const payment = payments.get(String(body.tid ?? ''))
    if (!payment) return kakaoError(res, 400, -780, 'approval failure!', 'NOT_FOUND')
    const instruction = next.approve
    next.approve = null
    if (instruction?.mode === 'decline')
      return kakaoError(res, 400, -780, 'approval failure!', 'USER_LOCKED')
    if (instruction?.mode === 'error') return kakaoError(res, 500, -500, 'internal')
    if (instruction?.mode === 'delay')
      await new Promise((done) => setTimeout(done, instruction.delayMs ?? 12_000))
    const token = typeof body.pg_token === 'string' ? body.pg_token : ''
    const amountOk = body.total_amount === undefined || body.total_amount === payment.total
    if (
      body.partner_order_id !== payment.partnerOrderId ||
      body.partner_user_id !== payment.partnerUserId ||
      !token ||
      token !== payment.pgToken ||
      !amountOk ||
      payment.status !== 'AUTH_PASSWORD'
    )
      return kakaoError(
        res,
        400,
        -780,
        'approval failure!',
        payment.status === 'SUCCESS_PAYMENT' ? 'ALREADY_APPROVED' : 'USER_LOCKED',
      )
    payment.status = 'SUCCESS_PAYMENT'
    payment.approvedAt = kst()
    if (instruction?.mode === 'lose') return res.destroy() // 적용했지만 답이 유실됐다
    return send(res, 200, {
      aid: aidOf(payment.tid),
      tid: payment.tid,
      cid: FAKE_KAKAOPAY.cid,
      partner_order_id: payment.partnerOrderId,
      partner_user_id: payment.partnerUserId,
      payment_method_type: 'CARD',
      item_name: payment.itemName + PLANTED.item,
      quantity: 1,
      amount: amountObject(payment.total),
      card_info: {
        bin: PLANTED.cardBin,
        kakaopay_issuer_corp: PLANTED.issuer,
        card_type: '체크',
        approved_id: '12345678',
      },
      created_at: kst(),
      approved_at: payment.approvedAt,
      buyer_name: PLANTED.name,
    })
  }

  function cancel(res: ServerResponse, body: Record<string, unknown>) {
    const payment = payments.get(String(body.tid ?? ''))
    if (!payment) return kakaoError(res, 400, -781, 'cancel failure!', '6666')
    const asked = body.cancel_amount
    if (!Number.isInteger(asked)) return kakaoError(res, 400, -400, 'missing field')
    if ((asked as number) <= 0 || (asked as number) > availableOf(payment))
      return kakaoError(res, 400, -781, 'cancel failure!', '6666')
    const aid = `C${String(++sequence).padStart(19, '0')}`
    payment.cancels.push({ aid, amount: asked as number, at: kst() })
    payment.status = availableOf(payment) === 0 ? 'CANCEL_PAYMENT' : 'PART_CANCEL_PAYMENT'
    return send(res, 200, {
      aid,
      tid: payment.tid,
      cid: FAKE_KAKAOPAY.cid,
      status: payment.status,
      partner_order_id: payment.partnerOrderId,
      partner_user_id: payment.partnerUserId,
      payment_method_type: 'CARD',
      amount: amountObject(payment.total),
      approved_cancel_amount: amountObject(asked as number),
      canceled_amount: amountObject(canceledOf(payment)),
      cancel_available_amount: amountObject(availableOf(payment)),
      created_at: kst(),
      approved_at: payment.approvedAt,
      canceled_at: payment.cancels.at(-1)?.at,
      buyer_name: PLANTED.name,
    })
  }

  function order(res: ServerResponse, body: Record<string, unknown>) {
    const payment = payments.get(String(body.tid ?? ''))
    if (!payment) return kakaoError(res, 400, -780, 'not found', 'NOT_FOUND')
    const actions = [
      ...(payment.approvedAt
        ? [
            {
              aid: aidOf(payment.tid),
              payment_action_type: 'PAYMENT',
              amount: payment.total,
              approved_at: payment.approvedAt,
            },
          ]
        : []),
      ...payment.cancels.map((c) => ({
        aid: c.aid,
        payment_action_type: 'CANCEL',
        amount: c.amount,
        approved_at: c.at,
      })),
    ]
    return send(res, 200, {
      tid: payment.tid,
      cid: FAKE_KAKAOPAY.cid,
      status: payment.status,
      partner_order_id: payment.partnerOrderId,
      partner_user_id: payment.partnerUserId,
      payment_method_type: 'CARD',
      item_name: payment.itemName + PLANTED.item,
      quantity: 1,
      amount: amountObject(payment.total),
      canceled_amount: amountObject(canceledOf(payment)),
      cancel_available_amount: amountObject(availableOf(payment)),
      created_at: kst(),
      approved_at: payment.approvedAt,
      selected_card_info: { card_bin: PLANTED.cardBin, card_corp_name: PLANTED.issuer },
      payment_action_details: actions,
    })
  }

  /** 구매자의 결제창 - 어디로 돌려보낼지 제어가 정한다. 기본은 인증을 마치고 `approval_url` + `pg_token` 으로 */
  function buyerWindow(res: ServerResponse, tid: string) {
    const payment = payments.get(tid)
    if (!payment) {
      res.writeHead(404, { 'Content-Type': 'text/plain;charset=UTF-8' })
      return res.end('no such payment')
    }
    const instruction = next.buyer
    next.buyer = null
    if (instruction === 'leave') {
      res.writeHead(200, { 'Content-Type': 'text/html;charset=UTF-8' })
      return res.end('<!doctype html><title>KakaoPay (fake)</title><p>waiting for the buyer</p>')
    }
    let target: string
    if (instruction === 'cancel') {
      payment.status = 'QUIT_PAYMENT'
      target = payment.cancelUrl
    } else if (instruction === 'fail') {
      payment.status = 'FAIL_PAYMENT'
      target = payment.failUrl
    } else {
      payment.pgToken = `pgtok_${randomUUID().replaceAll('-', '').slice(0, 20)}`
      if (payment.status === 'READY') payment.status = 'AUTH_PASSWORD'
      target = withToken(payment.approvalUrl, payment.pgToken)
    }
    res.writeHead(302, { Location: target })
    return res.end()
  }

  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const requestUrl = new URL(req.url ?? '/', 'http://fake')
    const path = requestUrl.pathname
    try {
      // 제어
      if (path === '/control') {
        if (req.method === 'GET') {
          return send(res, 200, {
            payments: [...payments.values()],
            calls,
            next,
          } satisfies FakeKakaoPayState)
        }
        const patch = (parse(await readBody(req)) ?? {}) as FakeKakaoPayPatch
        if (patch.reset) {
          payments.clear()
          calls = []
          next.buyer = null
          next.approve = null
        }
        if ('buyer' in patch) next.buyer = patch.buyer ?? null
        if ('approve' in patch) next.approve = patch.approve ?? null
        return send(res, 200, { ok: true })
      }

      // 구매자의 결제창 · 돌아가는 길
      const window = /^\/pay\/([^/]+)\/(?:info|mInfo|aInfo)$/.exec(path)
      if (req.method === 'GET' && window) return buyerWindow(res, window[1] ?? '')
      if (req.method === 'GET' && path === '/return') {
        if (!appUrl) return kakaoError(res, 500, -500, 'the app address is not set')
        res.writeHead(302, { Location: `${appUrl}/payments/return${requestUrl.search}` })
        return res.end()
      }

      // 카카오페이 API
      const api = /^\/online\/v1\/payment\/(ready|approve|cancel|order)$/.exec(path)
      if (!api) return kakaoError(res, 404, -404, 'no such function')
      const body = parse(await readBody(req))
      calls.push({ method: req.method ?? 'GET', path, body: redacted(body) })
      if (req.headers.authorization !== `SECRET_KEY ${FAKE_KAKAOPAY.secretKey}`)
        return kakaoError(res, 401, -401, 'unauthorized')
      if (req.method !== 'POST' || !body) return kakaoError(res, 400, -400, 'bad request')
      if (body.cid !== FAKE_KAKAOPAY.cid) return kakaoError(res, 400, -400, 'bad cid')
      switch (api[1]) {
        case 'ready':
          return ready(res, body)
        case 'approve':
          return await approve(res, body)
        case 'cancel':
          return cancel(res, body)
        default:
          return order(res, body)
      }
    } catch {
      if (!res.headersSent) kakaoError(res, 500, -500, 'internal')
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

/** 시험이 가짜 카카오페이를 제어한다 - `GET /control` 로 결제와 호출 기록을 읽는다 */
export function kakaoPayControl(url: string) {
  const post = (patch: FakeKakaoPayPatch) =>
    fetch(`${url}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  return {
    set: async (patch: FakeKakaoPayPatch) => {
      await post(patch)
    },
    state: async () => (await (await fetch(`${url}/control`)).json()) as FakeKakaoPayState,
  }
}
