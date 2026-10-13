import { createHmac, randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { BrowserContext } from 'playwright'

/*
 * 가짜 Paddle — 진짜 Paddle 없이 해외 결제 여정(결제창 → 웹훅 → 갱신 → 기간 끝 해지)을 브라우저로 끝까지 돌려 본다. `fakeToss.ts` 와 같은 자리 · 방식이다.
 * 토스와 다르게 **이 서버가 백엔드를 부른다**: Paddle 은 결과를 서명한 웹훅(`Paddle-Signature: ts=…;h1=HMAC-SHA256(secret, "ts:원문")`)으로 보낸다 — 이 서버가 그것을 만들어
 * `POST <백엔드>/api/v1/payments/webhooks/paddle` 로 쏜다(백엔드 주소는 기동 뒤 `setBackend` 로 준다). 본문 모양은 Paddle Billing 문서 그대로(`event_id` · `event_type` · `occurred_at` · `data`).
 *
 * Paddle API(백엔드가 부른다): POST /transactions {items:[{price_id,quantity}], custom_data} - 서버가 거래를 먼저 만든다(Bearer 키가 틀리면 403) → {data:{id:'txn_…'}}.
 *   POST /subscriptions/{id}/cancel {effective_from} — Bearer 키가 틀리면 403. `next_billing_period` 면 해지 예약(`scheduled_change`)을 걸고 `subscription.updated` 를 쏜다.
 * 결제창(Paddle.js)은 이 서버에 없다 — 시험이 스크립트(`https://cdn.paddle.com/paddle/v2/paddle.js`)를 가로채 `fakePaddleSdkScript` 로 바꾼다(`routePaddleSdk`).
 * 그 대역은 `Checkout.open({ transactionId })` 에서 이 서버의 `POST /sdk/checkout` 을 부르고(거래 id 만) 곧장 successUrl 로 돌려보낸다. 이 서버는 그때 미리 만들어진 거래(가격 · customData 는 백엔드가 정한 것)를 결제하고 구독을 만들어 웹훅 셋을 쏜다.
 *
 * 제어 `POST /control`:
 *   { renew: <결제사 구독 id> }      기간이 끝나 Paddle 이 다음 결제를 했다 — `transaction.completed`(subscription_recurring) + `subscription.updated`(새 기간)
 *   { endPeriod: <결제사 구독 id> }  해지 예약한 구독의 기간이 끝났다 — `subscription.canceled`
 *   { replay: <event_id> }           같은 사건을 (새 서명으로) 다시 쏜다 — 결제사의 재전송
 *   { stale: <결제사 구독 id> }      가장 새로운 상태보다 일찍 일어난 낡은 `subscription.updated`(ACTIVE)를 나중에 쏜다 — 순서가 뒤바뀐 전달
 *   { reset: true }                  모든 기록을 지운다
 * `GET /control` → { subscriptions, calls, sent } — `calls` 는 Paddle API 호출, `sent` 는 쏜 웹훅(event_id · event_type · 응답 상태).
 */

export const FAKE_PADDLE = {
  apiKey: 'pdl_sdbx_apikey_fake_e2e',
  clientToken: 'test_fake_e2e_client_token',
  webhookSecret: 'pdl_ntfset_fake_e2e_secret',
  /** 가짜 Paddle 의 가격 — 이 앱의 `skeleton.payment-paddle.prices` 가 이 id 를 가리킨다(`globalSetup.ts`). 금액은 구매자의 통화로(여러 통화). */
  prices: {
    basic: { id: 'pri_e2e_basic', recurring: true, amount: 399 },
    standard: { id: 'pri_e2e_standard', recurring: true, amount: 699 },
    pro: { id: 'pri_e2e_pro', recurring: true, amount: 999 },
    cheer1000: { id: 'pri_e2e_cheer_1000', recurring: false, amount: 99 },
  },
}

/** 웹훅 서명 헤더 — 백엔드의 검증과 같은 규칙(HMAC-SHA256, 서명 대상 `"<ts>:<원문>"`) */
export function paddleSignature(body: string, secret: string, ts: number): string {
  const h1 = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex')
  return `ts=${ts};h1=${h1}`
}

type Sub = {
  id: string
  status: 'active' | 'canceled' | 'past_due'
  customData: Record<string, string>
  currency: string
  amount: number
  periodStart: string
  periodEnd: string
  scheduledCancel: boolean
  txnCount: number
  priceId: string
}
export type FakePaddleCall = { method: string; path: string; authorized: boolean; body: unknown }
export type SentWebhook = { eventId: string; eventType: string; status: number }
export type FakePaddleTransaction = { id: string; items: Array<{ price_id: string; quantity: number }>; custom_data: Record<string, string> }
export type FakePaddleState = { subscriptions: Sub[]; calls: FakePaddleCall[]; sent: SentWebhook[]; transactions: FakePaddleTransaction[] }
export type FakePaddle = {
  url: string
  /** 백엔드 주소(`http://localhost:<포트>`) — 웹훅을 이 주소로 쏜다 */
  setBackend(url: string): void
  close(): Promise<void>
}

const iso = (d: Date) => d.toISOString()
const PERIOD_MS = 25_000

export async function startFakePaddle(): Promise<FakePaddle> {
  let backend = ''
  const subs = new Map<string, Sub>()
  let calls: FakePaddleCall[] = []
  let sent: SentWebhook[] = []
  const bodies = new Map<string, string>() // event_id → 쏜 원문(재전송용)
  const transactions = new Map<string, FakePaddleTransaction>() // 백엔드가 만든 거래
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }

  async function fire(eventType: string, data: unknown, occurredAt = new Date(), eventId = `evt_${randomUUID().replaceAll('-', '')}`) {
    const body = JSON.stringify({
      event_id: eventId,
      event_type: eventType,
      occurred_at: iso(occurredAt),
      notification_id: `ntf_${randomUUID().replaceAll('-', '')}`,
      data,
    })
    bodies.set(eventId, body)
    await post(eventId, eventType, body)
    return eventId
  }

  async function post(eventId: string, eventType: string, body: string) {
    const ts = Math.floor(Date.now() / 1000)
    const response = await fetch(`${backend}/api/v1/payments/webhooks/paddle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Paddle-Signature': paddleSignature(body, FAKE_PADDLE.webhookSecret, ts),
      },
      body,
    })
    sent.push({ eventId, eventType, status: response.status })
  }

  const subscriptionEntity = (s: Sub) => ({
    id: s.id,
    status: s.status,
    currency_code: s.currency,
    custom_data: s.customData,
    scheduled_change: s.scheduledCancel ? { action: 'cancel', effective_at: s.periodEnd, resume_at: null } : null,
    current_billing_period: { starts_at: s.periodStart, ends_at: s.periodEnd },
  })

  function transactionEntity(s: Sub | null, customData: Record<string, string>, currency: string, amount: number, origin: string, priceId: string, transactionId?: string) {
    const at = iso(new Date())
    return {
      id: transactionId ?? `txn_${randomUUID().replaceAll('-', '').slice(0, 26)}`,
      status: 'completed',
      currency_code: currency,
      origin,
      ...(s ? { subscription_id: s.id } : {}),
      custom_data: customData,
      items: [{ price: { id: priceId }, quantity: 1 }],
      billed_at: at,
      billing_period: s ? { starts_at: s.periodStart, ends_at: s.periodEnd } : null,
      details: { totals: { subtotal: String(amount), tax: '0', total: String(amount), currency_code: currency } },
      payments: [{ status: 'captured', method_details: { type: 'card', card: { type: 'visa', last4: '4242' } } }],
    }
  }

  /** 결제창 대역이 부른다 - 백엔드가 미리 만든 거래를 결제하고 웹훅을 쏜다(구독 가격이면 구독도). 모르는 거래면 거절 */
  async function checkout(res: ServerResponse, body: Record<string, unknown> | null) {
    const txn = transactions.get(String(body?.transactionId ?? ''))
    if (!txn || body?.token !== FAKE_PADDLE.clientToken) return send(res, 400, { error: 'unknown transaction or token' }, cors)
    const price = Object.values(FAKE_PADDLE.prices).find((p) => p.id === txn.items[0]?.price_id)
    if (!price) return send(res, 400, { error: 'unknown price' }, cors)
    const customData = txn.custom_data
    const currency = 'USD'
    if (!price.recurring) {
      await fire('transaction.completed', transactionEntity(null, customData, currency, price.amount, 'web', price.id, txn.id))
      return send(res, 200, { ok: true }, cors)
    }
    const now = new Date()
    const sub: Sub = {
      id: `sub_${randomUUID().replaceAll('-', '').slice(0, 26)}`,
      status: 'active',
      customData,
      currency,
      amount: price.amount,
      periodStart: iso(now),
      periodEnd: iso(new Date(now.getTime() + PERIOD_MS)),
      scheduledCancel: false,
      txnCount: 1,
      priceId: price.id,
    }
    subs.set(sub.id, sub)
    // Paddle 은 결제를 먼저 알리고 구독을 만든다
    await fire('transaction.completed', transactionEntity(sub, customData, currency, price.amount, 'web', price.id, txn.id))
    await fire('subscription.created', { ...subscriptionEntity(sub), transaction_id: txn.id })
    await fire('subscription.activated', subscriptionEntity(sub))
    return send(res, 200, { ok: true, subscriptionId: sub.id }, cors)
  }

  async function control(res: ServerResponse, patch: Record<string, unknown>) {
    if (patch.reset) {
      subs.clear()
      calls = []
      sent = []
      bodies.clear()
      transactions.clear()
    }
    if (typeof patch.renew === 'string') {
      const s = subs.get(patch.renew)
      if (!s) return send(res, 404, { error: 'no such subscription' })
      const start = new Date(s.periodEnd)
      s.periodStart = iso(start)
      s.periodEnd = iso(new Date(start.getTime() + PERIOD_MS))
      s.txnCount += 1
      await fire('transaction.completed', transactionEntity(s, s.customData, s.currency, s.amount, 'subscription_recurring', s.priceId))
      await fire('subscription.updated', subscriptionEntity(s))
    }
    if (typeof patch.endPeriod === 'string') {
      const s = subs.get(patch.endPeriod)
      if (!s) return send(res, 404, { error: 'no such subscription' })
      s.status = 'canceled'
      await fire('subscription.canceled', subscriptionEntity(s))
    }
    if (typeof patch.replay === 'string') {
      const body = bodies.get(patch.replay)
      if (!body) return send(res, 404, { error: 'no such event' })
      const parsed = JSON.parse(body) as { event_type: string }
      await post(patch.replay, parsed.event_type, body)
    }
    if (typeof patch.stale === 'string') {
      const s = subs.get(patch.stale)
      if (!s) return send(res, 404, { error: 'no such subscription' })
      await fire('subscription.updated', subscriptionEntity({ ...s, status: 'active', scheduledCancel: false }), new Date(Date.now() - 60 * 60_000))
    }
    return send(res, 200, { subscriptions: [...subs.values()], calls, sent, transactions: [...transactions.values()] } satisfies FakePaddleState)
  }

  const server: Server = createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => send(res, 500, { error: String(error) }))
  })

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const path = (req.url ?? '/').split('?')[0] as string
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' })
      return res.end()
    }
    const text = await readBody(req)
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : null
    if (path === '/control') return req.method === 'GET' ? control(res, {}) : control(res, body ?? {})
    if (path === '/sdk/checkout' && req.method === 'POST') return checkout(res, body)

    if (path === '/transactions' && req.method === 'POST') {
      const authorized = req.headers.authorization === `Bearer ${FAKE_PADDLE.apiKey}`
      calls.push({ method: req.method, path, authorized, body })
      if (!authorized) return send(res, 403, { error: { code: 'forbidden' } })
      const txn: FakePaddleTransaction = {
        id: `txn_${randomUUID().replaceAll('-', '').slice(0, 26)}`,
        items: (body?.items as FakePaddleTransaction['items'] | undefined) ?? [],
        custom_data: (body?.custom_data as Record<string, string> | undefined) ?? {},
      }
      transactions.set(txn.id, txn)
      return send(res, 200, { data: { id: txn.id, status: 'draft', ...txn } })
    }

    const cancel = /^\/subscriptions\/([^/]+)\/cancel$/.exec(path)
    if (cancel && req.method === 'POST') {
      const authorized = req.headers.authorization === `Bearer ${FAKE_PADDLE.apiKey}`
      calls.push({ method: req.method, path, authorized, body })
      if (!authorized) return send(res, 403, { error: { code: 'forbidden' } })
      const s = subs.get(decodeURIComponent(cancel[1] as string))
      if (!s) return send(res, 404, { error: { code: 'not_found' } })
      if (body?.effective_from === 'immediately') s.status = 'canceled'
      else s.scheduledCancel = true
      await fire(s.status === 'canceled' ? 'subscription.canceled' : 'subscription.updated', subscriptionEntity(s))
      return send(res, 200, { data: subscriptionEntity(s) })
    }
    return send(res, 404, { error: 'not found' })
  }

  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as { port: number }
  return {
    url: `http://127.0.0.1:${port}`,
    setBackend: (url) => {
      backend = url.replace(/\/+$/, '')
    },
    close: () => new Promise<void>((done) => server.close(() => done())),
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let text = ''
    req.on('data', (chunk: Buffer) => (text += chunk.toString()))
    req.on('end', () => done(text))
    req.on('error', fail)
  })
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}

/** 시험이 가짜 Paddle 을 조종한다 */
export function paddleControl(fakeUrl: string) {
  const call = async (method: 'GET' | 'POST', body?: unknown) => {
    const response = await fetch(`${fakeUrl}/control`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return (await response.json()) as FakePaddleState
  }
  return { state: () => call('GET'), set: (patch: Record<string, unknown>) => call('POST', patch) }
}

/** Paddle.js 대역 — `Checkout.open` 이 이 서버에 결제를 만들게 하고 successUrl 로 돌려보낸다 */
export function fakePaddleSdkScript(fakeUrl: string): string {
  return `(function () {
  var FAKE = ${JSON.stringify(fakeUrl)};
  var token = null;
  window.Paddle = {
    Environment: { set: function () {} },
    Initialize: function (options) { token = options.token; },
    Checkout: {
      open: async function (options) {
        var response = await fetch(FAKE + '/sdk/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, transactionId: options.transactionId })
        });
        if (!response.ok) return;
        location.assign(options.settings.successUrl);
      }
    }
  };
})();`
}

export async function routePaddleSdk(context: BrowserContext, fakeUrl: string) {
  await context.route('https://cdn.paddle.com/paddle/v2/paddle.js*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fakePaddleSdkScript(fakeUrl) }),
  )
}
