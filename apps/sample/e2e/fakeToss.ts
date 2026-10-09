import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { BrowserContext } from 'playwright'

/*
 * 가짜 토스페이먼츠 — 진짜 토스 없이 결제 여정(결제창 → 승인 → 조회 → 환불)을 브라우저로 끝까지 돌려 본다. `fakeProviders.ts`(가짜 LINE · X)와 같은 자리·방식이다.
 * 응답 모양은 백엔드의 가짜(`modules/payment-toss` 의 시험 소스 `FakeTossServer.kt` · `TossFixtures`)와 맞춘다 — 토스 문서 모양의 JSON:
 *   POST /v1/payments/confirm                  승인 {paymentKey, orderId, amount}  → 결제 객체(DONE) · 거절 400 REJECT_CARD_COMPANY …
 *   POST /v1/payments/{paymentKey}/cancel      취소(= 우리 말로 환불) {cancelReason, cancelAmount?} → cancels[] 가 붙은 결제 객체(PARTIAL_CANCELED · CANCELED)
 *   GET  /v1/payments/{paymentKey} · /v1/payments/orders/{orderId}   조회
 * 일부러 진짜처럼 엄격하다: Basic 인증(`<시크릿 키>:`)이 틀리면 401 UNAUTHORIZED_KEY, 모든 POST 에 `Idempotency-Key` 가 있어야 하고(같은 키는 같은 답을 다시 준다), 인증한 금액과
 * 다른 승인은 거절하고, 이미 끝난 결제의 다른 키 승인은 ALREADY_PROCESSED_PAYMENT, 남은 금액보다 많은 취소는 NOT_CANCELABLE_AMOUNT.
 *
 * 브라우저가 부르는 결제창(토스 SDK v2)은 이 서버에 없다 — 시험이 SDK 스크립트 요청(`https://js.tosspayments.com/v2/standard`)을 가로채 `fakeSdkScript` 로 바꾼다(`routeTossSdk`).
 * 그 대역은 이 서버의 `POST /sdk/authorize` 로 "카드 인증을 마친" 결제를 만들고(결제 키 발급) 곧장 successUrl 로 돌려보낸다.
 *
 * 제어 `POST /control` — 다음에 일어날 일을 **한 번만** 정한다(앞 시나리오의 지시가 다음 시나리오에 남지 않게):
 *   { sdk: 'cancel' | 'cancel-no-order-id' | 'leave' | null }   다음 결제창: 사용자가 닫는다(failUrl · PAY_PROCESS_CANCELED) · 닫는데 failUrl 에 orderId 를 싣지 않는다(진짜 토스가 그럴 수 있다 — 화면은 우리가 failUrl 에 실은 주문 id 로 안다) ·
 *                                              인증만 하고 떠난다(결제는 IN_PROGRESS 로 남고 창은 돌아오지 않는다)
 *   { confirm: { mode: 'decline'|'delay'|'lose'|'error', code?, delayMs? } | null }   다음 승인: 카드사 거절 · 늦게 답함 · 적용했지만 답이 유실됨(연결 끊김) · 5xx(적용 안 됨)
 *   { complete: <orderId> }                    나중에 결제를 끝낸다(승인 호출 없이 DONE) — 사용자가 뒤늦게 끝낸 결제를 조회가 맞추는 시나리오
 *   { cardNumber: '<가려진 번호>' | null }     이후 결제의 카드 번호(기본 `43301234****1234` → 현대카드 ····1234)
 *   { reset: true }                            모든 결제 · 호출 기록 · 지시를 지운다
 * `GET /control` → { payments, calls, next }  — `calls` 는 토스 API(/v1/…) 호출만(결제창 · 제어 트래픽은 빼고) 시각 순으로, 멱등 키와 본문과 함께.
 */

export const FAKE_TOSS = {
  secretKey: 'test_sk_fake_e2e_secret',
  clientKey: 'test_ck_fake_e2e_client',
}

/** 응답에 일부러 심는 개인정보 — 이 값이 화면 · 우리 API 응답 어디에도 나오면 안 된다(백엔드의 `TossFixtures.PLANTED` 와 같은 값) */
export const PLANTED = {
  name: '홍길동',
  email: 'gildong.hong@example.test',
  phone: '01012345678',
  fullCardNumber: '4330123412341234',
}

type Cancel = {
  cancelReason: string
  canceledAt: string
  cancelAmount: number
  taxFreeAmount: number
  refundableAmount: number
  transactionKey: string
  cancelStatus: 'DONE'
  cardNumber: string
  receiptKey: null
}

type Payment = {
  paymentKey: string
  orderId: string
  orderName: string
  currency: string
  amount: number
  balance: number
  status: 'IN_PROGRESS' | 'DONE' | 'PARTIAL_CANCELED' | 'CANCELED' | 'ABORTED'
  requestedAt: string
  approvedAt: string | null
  cancels: Cancel[]
  cardNumber: string
}

export type ConfirmInstruction = {
  mode: 'decline' | 'delay' | 'lose' | 'error'
  code?: string
  delayMs?: number
}
type SdkInstruction = 'cancel' | 'cancel-no-order-id' | 'leave'

export type FakeTossCall = {
  method: string
  path: string
  idempotencyKey: string | null
  body: Record<string, unknown> | null
}
export type FakeTossState = {
  payments: Payment[]
  calls: FakeTossCall[]
  next: { sdk: SdkInstruction | null; confirm: ConfirmInstruction | null }
}
export type FakeTossPatch = {
  sdk?: SdkInstruction | null
  confirm?: ConfirmInstruction | null
  complete?: string
  cardNumber?: string | null
  reset?: boolean
}

export type FakeToss = { url: string; close: () => Promise<void> }

const DEFAULT_CARD_NUMBER = '43301234****1234'

const now = () => new Date().toISOString().replace(/\.\d+Z$/, '+00:00')

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

const send = (
  res: ServerResponse,
  status: number,
  value: unknown,
  headers: Record<string, string> = {},
) => {
  res.writeHead(status, { 'Content-Type': 'application/json;charset=UTF-8', ...headers })
  res.end(JSON.stringify(value))
}
const tossError = (
  res: ServerResponse,
  status: number,
  code: string,
  message = `${code}: ${PLANTED.name} ${PLANTED.email}`,
) => send(res, status, { code, message })

/** 토스 결제 객체(승인 · 취소 · 조회 응답이 모두 이 모양이다). 개인정보는 [PLANTED] 로 일부러 심는다 */
function paymentObject(p: Payment) {
  return {
    mId: 'tosstest',
    version: '2022-11-16',
    paymentKey: p.paymentKey,
    orderId: p.orderId,
    orderName: p.orderName,
    status: p.status,
    requestedAt: p.requestedAt,
    approvedAt: p.approvedAt,
    currency: p.currency,
    totalAmount: p.amount,
    balanceAmount: p.balance,
    suppliedAmount: p.amount,
    vat: 0,
    method: '카드',
    lastTransactionKey: p.cancels.at(-1)?.transactionKey ?? null,
    cancels: p.cancels.length > 0 ? p.cancels : null,
    card: {
      issuerCode: '61',
      acquirerCode: '31',
      number: p.cardNumber,
      installmentPlanMonths: 0,
      approveNo: '00000000',
      cardType: '신용',
      ownerType: '개인',
      amount: p.amount,
    },
    customerName: PLANTED.name,
    customerEmail: PLANTED.email,
    customerMobilePhone: PLANTED.phone,
    metadata: { note: PLANTED.name },
    unknownFutureField: { nested: [1, 2, 3] },
  }
}

export async function startFakeToss(): Promise<FakeToss> {
  const payments = new Map<string, Payment>() // paymentKey → 결제
  let calls: FakeTossCall[] = []
  const replies = new Map<string, { status: number; body: unknown }>() // 멱등 키 → 처음 준 답
  const next: FakeTossState['next'] = { sdk: null, confirm: null }
  let cardNumber: string | null = null
  const byOrder = (orderId: string) => [...payments.values()].find((p) => p.orderId === orderId)
  const expectedAuth = `Basic ${Buffer.from(`${FAKE_TOSS.secretKey}:`).toString('base64')}`

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  /** 결제창 대역이 부른다 — "카드 인증을 마친" 결제를 만든다. 사용자가 닫으면 만들지 않는다 */
  function authorize(res: ServerResponse, body: Record<string, unknown> | null) {
    const instruction = next.sdk
    next.sdk = null
    const orderId = String(body?.orderId ?? '')
    if (instruction === 'cancel' || instruction === 'cancel-no-order-id')
      return send(
        res,
        200,
        {
          ok: false,
          fail: { code: 'PAY_PROCESS_CANCELED', message: '사용자가 결제를 취소하였습니다.' },
          ...(instruction === 'cancel-no-order-id' ? { withoutOrderId: true } : {}),
        },
        cors,
      )
    const payment: Payment = {
      paymentKey: `pay_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
      orderId,
      orderName: String(body?.orderName ?? ''),
      currency: String(body?.currency ?? 'KRW'),
      amount: Number(body?.amount ?? 0),
      balance: Number(body?.amount ?? 0),
      status: 'IN_PROGRESS',
      requestedAt: now(),
      approvedAt: null,
      cancels: [],
      cardNumber: cardNumber ?? DEFAULT_CARD_NUMBER,
    }
    payments.set(payment.paymentKey, payment)
    return send(
      res,
      200,
      {
        ok: true,
        paymentKey: payment.paymentKey,
        ...(instruction === 'leave' ? { leave: true } : {}),
      },
      cors,
    )
  }

  function approve(p: Payment) {
    p.status = 'DONE'
    p.approvedAt = now()
  }

  async function confirm(res: ServerResponse, body: Record<string, unknown> | null, key: string) {
    const payment = payments.get(String(body?.paymentKey ?? ''))
    if (!payment || payment.orderId !== body?.orderId)
      return tossError(res, 404, 'NOT_FOUND_PAYMENT_SESSION')
    if (payment.status !== 'IN_PROGRESS') return tossError(res, 400, 'ALREADY_PROCESSED_PAYMENT')
    if (Number(body?.amount) !== payment.amount) return tossError(res, 400, 'INVALID_REQUEST')
    const instruction = next.confirm
    next.confirm = null
    if (instruction?.mode === 'decline') {
      payment.status = 'ABORTED'
      return tossError(
        res,
        400,
        instruction.code ?? 'REJECT_CARD_COMPANY',
        '카드사에서 승인을 거절했습니다.',
      )
    }
    if (instruction?.mode === 'error')
      return tossError(res, 500, 'FAILED_INTERNAL_SYSTEM_PROCESSING')
    if (instruction?.mode === 'delay')
      await new Promise((r) => setTimeout(r, instruction.delayMs ?? 1000))
    approve(payment)
    const reply = { status: 200, body: paymentObject(payment) }
    replies.set(key, reply)
    // 적용은 됐지만 답이 닿지 않는다 — 같은 멱등 키로 다시 부르면 처음 답이 나온다
    if (instruction?.mode === 'lose') return void res.socket?.destroy()
    return send(res, reply.status, reply.body)
  }

  function cancel(
    res: ServerResponse,
    paymentKey: string,
    body: Record<string, unknown> | null,
    key: string,
  ) {
    const payment = payments.get(paymentKey)
    if (!payment) return tossError(res, 404, 'NOT_FOUND_PAYMENT')
    if (payment.status === 'CANCELED') return tossError(res, 400, 'ALREADY_CANCELED_PAYMENT')
    if (payment.status !== 'DONE' && payment.status !== 'PARTIAL_CANCELED')
      return tossError(res, 400, 'NOT_CANCELABLE_PAYMENT')
    const amount = body?.cancelAmount === undefined ? payment.balance : Number(body.cancelAmount)
    if (!Number.isInteger(amount) || amount <= 0 || amount > payment.balance)
      return tossError(res, 400, 'NOT_CANCELABLE_AMOUNT')
    payment.balance -= amount
    payment.status = payment.balance === 0 ? 'CANCELED' : 'PARTIAL_CANCELED'
    payment.cancels.push({
      cancelReason: String(body?.cancelReason ?? ''),
      canceledAt: now(),
      cancelAmount: amount,
      taxFreeAmount: 0,
      refundableAmount: payment.balance,
      transactionKey: `txn_${randomUUID().replaceAll('-', '').slice(0, 24)}`,
      cancelStatus: 'DONE',
      cardNumber: PLANTED.fullCardNumber,
      receiptKey: null,
    })
    const reply = { status: 200, body: paymentObject(payment) }
    replies.set(key, reply)
    return send(res, reply.status, reply.body)
  }

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://fake')
    const path = url.pathname
    const raw = await readBody(req)
    const body = parse(raw)

    if (req.method === 'OPTIONS')
      return void res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'POST' }).end()

    if (path === '/control') {
      if (req.method === 'POST') {
        const patch = (body ?? {}) as FakeTossPatch
        if (patch.reset) {
          payments.clear()
          replies.clear()
          calls = []
          next.sdk = null
          next.confirm = null
          cardNumber = null
        }
        if ('sdk' in patch) next.sdk = patch.sdk ?? null
        if ('confirm' in patch) next.confirm = patch.confirm ?? null
        if ('cardNumber' in patch) cardNumber = patch.cardNumber ?? null
        if (patch.complete) {
          const target = byOrder(patch.complete)
          if (!target) return send(res, 404, { error: `no payment for order ${patch.complete}` })
          if (target.status === 'IN_PROGRESS') approve(target)
        }
      }
      return send(res, 200, {
        payments: [...payments.values()],
        calls,
        next,
      } satisfies FakeTossState)
    }

    if (path === '/sdk/authorize' && req.method === 'POST') return authorize(res, body)

    if (!path.startsWith('/v1/payments')) return send(res, 404, { error: 'not found' })

    // 토스 API — 인증 · 기록
    const idempotencyKey = (req.headers['idempotency-key'] as string | undefined) ?? null
    calls.push({ method: req.method ?? 'GET', path, idempotencyKey, body })
    if (req.headers.authorization !== expectedAuth) return tossError(res, 401, 'UNAUTHORIZED_KEY')
    if (req.method === 'POST' && !idempotencyKey) return tossError(res, 400, 'INVALID_REQUEST')
    const replay = idempotencyKey ? replies.get(idempotencyKey) : undefined
    if (replay) return send(res, replay.status, replay.body)

    if (req.method === 'POST' && path === '/v1/payments/confirm')
      return confirm(res, body, idempotencyKey as string)
    const cancelMatch = /^\/v1\/payments\/([^/]+)\/cancel$/.exec(path)
    if (req.method === 'POST' && cancelMatch)
      return cancel(
        res,
        decodeURIComponent(cancelMatch[1] as string),
        body,
        idempotencyKey as string,
      )
    if (req.method === 'GET') {
      const orderMatch = /^\/v1\/payments\/orders\/([^/]+)$/.exec(path)
      const keyMatch = /^\/v1\/payments\/([^/]+)$/.exec(path)
      const found = orderMatch
        ? byOrder(decodeURIComponent(orderMatch[1] as string))
        : keyMatch
          ? payments.get(decodeURIComponent(keyMatch[1] as string))
          : undefined
      return found ? send(res, 200, paymentObject(found)) : tossError(res, 404, 'NOT_FOUND_PAYMENT')
    }
    return tossError(res, 404, 'NOT_FOUND_PAYMENT')
  }

  const server: Server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (!res.headersSent) send(res, 500, { code: 'FAKE_TOSS_BUG', message: String(error) })
    })
  })
  // 루프백에만 묶는다 — 와일드카드는 다른 프로세스에 연결이 가로채인다
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as { port: number }
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections()
        server.close(() => done())
      }),
  }
}

/**
 * 시험이 직접 부르는 결제창 대역의 서버 쪽 — "카드 인증을 마친" 결제를 만든다. 브라우저의 대역 스크립트가 하는 일과 같다.
 * 결제창이 닫히는(`sdk: 'cancel'`) 경우는 던진다 — 그 길은 `POST /sdk/authorize` 를 직접 부른다
 */
export async function authorizeAtFakeToss(
  fakeUrl: string,
  input: { orderId: string; amount: number; orderName?: string; currency?: string },
): Promise<{ paymentKey: string }> {
  const response = await fetch(`${fakeUrl}/sdk/authorize`, {
    method: 'POST',
    body: JSON.stringify({ currency: 'KRW', orderName: '', ...input }),
  })
  const result = (await response.json()) as { ok: boolean; paymentKey?: string }
  if (!result.ok || !result.paymentKey)
    throw new Error(`fake toss did not authorize ${input.orderId}: ${JSON.stringify(result)}`)
  return { paymentKey: result.paymentKey }
}

/** `POST /control` · `GET /control` 의 얇은 껍데기 */
export function tossControl(fakeUrl: string) {
  const call = async (method: 'GET' | 'POST', patch?: FakeTossPatch) => {
    const response = await fetch(`${fakeUrl}/control`, {
      method,
      ...(patch ? { body: JSON.stringify(patch) } : {}),
    })
    if (!response.ok)
      throw new Error(`fake toss /control → ${response.status} ${await response.text()}`)
    return (await response.json()) as FakeTossState
  }
  return {
    set: (patch: FakeTossPatch) => call('POST', patch),
    state: () => call('GET'),
    /** 이 주문에 대해 가짜 토스가 받은 승인 호출 */
    confirmCalls: (state: FakeTossState, orderId: string) =>
      state.calls.filter((c) => c.path === '/v1/payments/confirm' && c.body?.orderId === orderId),
    /** 이 주문에 대한 모든 호출 — 주문 번호가 본문에 있거나, 주문 번호로 조회했거나, 이 주문의 결제 키로 부른 것. 다른 주문의 호출은 빼서 "이 주문에 호출이 늘지 않았다"를 다른 데서 난 호출에 흔들리지 않고 센다 */
    callsFor: (state: FakeTossState, orderId: string) => {
      const keys = state.payments.filter((p) => p.orderId === orderId).map((p) => p.paymentKey)
      return state.calls.filter(
        (c) =>
          c.body?.orderId === orderId ||
          c.path === `/v1/payments/orders/${orderId}` ||
          keys.some(
            (key) => c.path === `/v1/payments/${key}` || c.path.startsWith(`/v1/payments/${key}/`),
          ),
      )
    },
  }
}

/**
 * 브라우저가 받을 토스 SDK v2 대역 — `window.TossPayments(clientKey).payment({customerKey}).requestPayment({...})` 하나만 흉내 낸다(`@skeleton/payment` 의 `openCheckout` 이 부르는 모양).
 * 가짜 토스의 `/sdk/authorize` 로 결제를 만들고, 성공이면 곧장 `successUrl?paymentKey&orderId&amount`, 실패면 `failUrl?code&message&orderId` 로 이동한다(`withoutOrderId` 면 `orderId` 없이 — 앱이 failUrl 에 실은 쿼리는 그대로 남는다).
 * `leave` 면 인증만 하고 떠난 사용자 — 이동도 끝남도 없이 약속이 영원히 열려 있다.
 * `window` · `fetch` · `location` 은 실행하는 쪽이 준다(브라우저에서는 전역 그대로 — `new Function` 으로 감싸 시험한다)
 */
export function fakeSdkScript(fakeUrl: string): string {
  return `(function () {
  var FAKE = ${JSON.stringify(fakeUrl)};
  window.TossPayments = function (clientKey) {
    return {
      payment: function () {
        return {
          requestPayment: async function (request) {
            var response = await fetch(FAKE + '/sdk/authorize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientKey: clientKey,
                orderId: request.orderId,
                orderName: request.orderName,
                amount: request.amount.value,
                currency: request.amount.currency,
                method: request.method
              })
            });
            var result = await response.json();
            if (result.leave) return new Promise(function () {});
            var back;
            if (result.ok) {
              back = new URL(request.successUrl);
              back.searchParams.set('paymentKey', result.paymentKey);
              back.searchParams.set('orderId', request.orderId);
              back.searchParams.set('amount', String(request.amount.value));
            } else {
              back = new URL(request.failUrl);
              back.searchParams.set('code', result.fail.code);
              back.searchParams.set('message', result.fail.message);
              if (!result.withoutOrderId) back.searchParams.set('orderId', request.orderId);
            }
            location.assign(back.toString());
          }
        };
      }
    };
  };
  window.TossPayments.ANONYMOUS = '@@ANONYMOUS';
})();`
}

/** 이 브라우저 컨텍스트가 토스 SDK 를 가짜로 받게 한다(진짜 `js.tosspayments.com` 에는 닿지 않는다) */
export async function routeTossSdk(context: BrowserContext, fakeUrl: string) {
  await context.route('https://js.tosspayments.com/v2/standard*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: fakeSdkScript(fakeUrl),
    }),
  )
}
