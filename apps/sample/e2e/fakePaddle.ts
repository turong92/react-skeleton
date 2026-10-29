import { createHmac, randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { BrowserContext } from 'playwright'

/*
 * 가짜 Paddle — 진짜 Paddle 없이 해외 결제 여정(결제창 → 웹훅 → 갱신 → 기간 끝 해지)을 브라우저로 끝까지 돌려 본다. `fakeToss.ts` 와 같은 자리 · 방식이다.
 * 토스와 다르게 **이 서버가 백엔드를 부른다**: Paddle 은 결과를 서명한 웹훅(`Paddle-Signature: ts=…;h1=HMAC-SHA256(secret, "ts:원문")`)으로 보낸다 — 이 서버가 그것을 만들어
 * `POST <백엔드>/api/v1/payments/webhooks/paddle` 로 쏜다(백엔드 주소는 기동 뒤 `setBackend` 로 준다). 본문 모양은 Paddle Billing 문서 그대로(`event_id` · `event_type` · `occurred_at` · `data`).
 *
 * 환불(adjustment): GET /transactions/{id}?include=adjustments(거래 조회 - Bearer 키가 틀리면 403) · POST /adjustments {action:'refund', transaction_id, type, items?} - 검토 중인 환불이 있으면 409 `adjustment_pending_refund_request`,
 *   남은 금액을 넘으면 400 `adjustment_total_above_remaining_allowed`. 기본은 Paddle 실계정처럼 **검토 중**(`pending_approval`)으로 답하고 `adjustment.created` 를 쏜다 - 결정은 시험이 `{ decide }` 로 내린다(`adjustment.updated`).
 * Paddle API(백엔드가 부른다): POST /transactions {items:[{price_id,quantity}], custom_data} - 서버가 거래를 먼저 만든다(Bearer 키가 틀리면 403) → {data:{id:'txn_…'}}.
 *   PATCH /subscriptions/{id}/preview · PATCH /subscriptions/{id} {items:[{price_id,quantity}], proration_billing_mode} - 플랜 바꾸기. **`prorated_immediately` 만** 받는다(아니면 400). 남은 시간 비율로 일할:
 *     새 가격 × 비율 − 옛 가격 × 비율 = 낼 돈(`grand_total`, 음수면 0). 미리보기의 `immediate_transaction.details.totals` 는 `{total: 낼 돈, credit: 0, grand_total: 낼 돈}`, 총액 · 크레딧은 `update_summary.charge` · `update_summary.credit.amount`(음수). 실행이면 `transaction.completed`(`origin: subscription_update`, `total` = 실제 낸 돈, `credit` 0, `line_items` 새 품목 + · 옛 품목 -1) + `subscription.updated`(새 `items`)를 쏜다. 미리보기의 `update_summary.credit.amount` 는 음수, 실행 응답의 금액 칸은 null.
 *   POST /subscriptions/{id}/cancel {effective_from} — Bearer 키가 틀리면 403. `next_billing_period` 면 해지 예약(`scheduled_change`)을 걸고 `subscription.updated` 를 쏜다.
 * 결제창(Paddle.js)은 이 서버에 없다 — 시험이 스크립트(`https://cdn.paddle.com/paddle/v2/paddle.js`)를 가로채 `fakePaddleSdkScript` 로 바꾼다(`routePaddleSdk`).
 * 그 대역은 `Checkout.open({ transactionId })` 에서 이 서버의 `POST /sdk/checkout` 을 부르고(거래 id 만) 곧장 successUrl 로 돌려보낸다. 이 서버는 그때 미리 만들어진 거래(가격 · customData 는 백엔드가 정한 것)를 결제하고 구독을 만들어 웹훅 셋을 쏜다.
 *
 * 제어 `POST /control`:
 *   { renew: <결제사 구독 id> }      기간이 끝나 Paddle 이 다음 결제를 했다 — `transaction.completed`(subscription_recurring) + `subscription.updated`(새 기간)
 *   { endPeriod: <결제사 구독 id> }  해지 예약한 구독의 기간이 끝났다 — `subscription.canceled`
 *   { replay: <event_id> }           같은 사건을 (새 서명으로) 다시 쏜다 — 결제사의 재전송
 *   { stale: <결제사 구독 id> }      가장 새로운 상태보다 일찍 일어난 낡은 `subscription.updated`(ACTIVE)를 나중에 쏜다 — 순서가 뒤바뀐 전달
 *   { refundMode: 'approve' | 'pending' }  이후 환불을 바로 승인하거나(기본 아님) 검토 중으로 둔다(기본 `pending`)
 *   { decide: { id, status } }       검토 중인 환불 `id`(adj_…)에 결정(`approved` · `rejected`)을 내리고 `adjustment.updated` 를 쏜다
 *   { chargeback: { transaction, warning? } }  구매자가 카드사에 이의를 제기했다 - Paddle 이 스스로 `chargeback`(경고면 `chargeback_warning`) adjustment 를 `approved` 로 만들고 `adjustment.created` 를 쏜다
 *   { winDispute: <adj_…> }          분쟁에서 이겼다 - 원래 adjustment 가 `reversed` 로 바뀌고(`adjustment.updated`) 되돌림 adjustment(`chargeback_reverse`)가 만들어진다(`adjustment.created`)
 *   { prorationRatio: <0~1 | null> }  플랜 변경의 일할 비율을 고정한다(null = 남은 시간 비율) - 시험이 금액을 정확히 말할 수 있게
 *   { reset: true }                  모든 기록을 지운다
 * `GET /control` → { subscriptions, calls, sent } — `calls` 는 Paddle API 호출, `sent` 는 쏜 웹훅(event_id · event_type · 응답 상태).
 */

export const FAKE_PADDLE = {
  apiKey: 'pdl_sdbx_apikey_fake_e2e',
  clientToken: 'test_fake_e2e_client_token',
  webhookSecret: 'pdl_ntfset_fake_e2e_secret',
  /** 가짜 Paddle 의 가격 — 이 앱의 `skeleton.payment-paddle.prices` 가 이 id 를 가리킨다(`globalSetup.ts`). 금액은 견본 시드의 USD 가격(센트)과 같다 - 백엔드가 DB 금액을 그대로 청구하고 Paddle 이 확정한 금액과 같아야 경고가 없다. */
  prices: {
    basic: { id: 'pri_e2e_basic', recurring: true, amount: 300 },
    standard: { id: 'pri_e2e_standard', recurring: true, amount: 500 },
    pro: { id: 'pri_e2e_pro', recurring: true, amount: 800 },
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
export type FakePaddleCall = {
  method: string
  path: string
  authorized: boolean
  body: unknown
  /** 플랜 변경(PATCH)이 돌려준 답의 `immediate_transaction.details.totals` - 창의 금액과 맞춰 보는 증거 */
  totals?: { total: string; credit: string; grand_total: string }
}
export type SentWebhook = { eventId: string; eventType: string; status: number }
export type FakePaddleTransaction = {
  id: string
  items: Array<{ price_id: string; quantity: number }>
  custom_data: Record<string, string>
}
export type FakePaddleAdjustment = {
  id: string
  action: 'refund' | 'chargeback' | 'chargeback_warning' | 'chargeback_reverse'
  status: 'pending_approval' | 'approved' | 'rejected' | 'reversed'
  transactionId: string
  total: number
  currency: string
}
type PaidTransaction = {
  id: string
  currency: string
  total: number
  priceId: string
  adjustments: FakePaddleAdjustment[]
}
export type FakePaddleState = {
  adjustments: FakePaddleAdjustment[]
  subscriptions: Sub[]
  calls: FakePaddleCall[]
  sent: SentWebhook[]
  transactions: FakePaddleTransaction[]
}
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
  const paid = new Map<string, PaidTransaction>() // 결제가 끝난(completed) 거래 - 환불이 걸린다
  let refundMode: 'approve' | 'pending' = 'pending'
  let prorationRatio: number | null = null // 플랜 변경의 일할 비율 - null 이면 남은 시간 비율
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  async function fire(
    eventType: string,
    data: unknown,
    occurredAt = new Date(),
    eventId = `evt_${randomUUID().replaceAll('-', '')}`,
  ) {
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
    items: [{ price: { id: s.priceId }, quantity: 1 }],
    scheduled_change: s.scheduledCancel
      ? { action: 'cancel', effective_at: s.periodEnd, resume_at: null }
      : null,
    current_billing_period: { starts_at: s.periodStart, ends_at: s.periodEnd },
  })

  function transactionEntity(
    s: Sub | null,
    customData: Record<string, string>,
    currency: string,
    amount: number,
    origin: string,
    priceId: string,
    transactionId?: string,
  ) {
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
      details: {
        totals: {
          subtotal: String(amount),
          tax: '0',
          total: String(amount),
          credit: '0',
          grand_total: String(amount),
          currency_code: currency,
        },
      },
      payments: [
        {
          status: 'captured',
          method_details: { type: 'card', card: { type: 'visa', last4: '4242' } },
        },
      ],
    }
  }

  const remember = (entity: ReturnType<typeof transactionEntity>, priceId: string) => {
    const totals = entity.details.totals
    paid.set(entity.id, {
      id: entity.id,
      currency: entity.currency_code,
      total: Number(totals.grand_total),
      priceId,
      adjustments: [],
    })
  }

  const adjustmentEntity = (a: FakePaddleAdjustment) => ({
    id: a.id,
    action: a.action,
    status: a.status,
    transaction_id: a.transactionId,
    currency_code: a.currency,
    created_at: iso(new Date()),
    totals: { total: String(a.total), currency_code: a.currency },
  })

  /** 결제가 끝난 거래의 조회 답 - Paddle 의 모양(금액은 최소 단위의 문자열) */
  const transactionBody = (t: PaidTransaction, withAdjustments: boolean) => ({
    data: {
      id: t.id,
      status: 'completed',
      currency_code: t.currency,
      billed_at: iso(new Date()),
      details: {
        totals: { total: String(t.total), currency_code: t.currency },
        line_items: [{ id: `txnitm_${t.id.slice(4)}`, price_id: t.priceId, quantity: 1 }],
      },
      ...(withAdjustments ? { adjustments: t.adjustments.map(adjustmentEntity) } : {}),
    },
  })

  /** 결제창 대역이 부른다 - 백엔드가 미리 만든 거래를 결제하고 웹훅을 쏜다(구독 가격이면 구독도). 모르는 거래면 거절 */
  async function checkout(res: ServerResponse, body: Record<string, unknown> | null) {
    const txn = transactions.get(String(body?.transactionId ?? ''))
    if (!txn || body?.token !== FAKE_PADDLE.clientToken)
      return send(res, 400, { error: 'unknown transaction or token' }, cors)
    const price = Object.values(FAKE_PADDLE.prices).find((p) => p.id === txn.items[0]?.price_id)
    if (!price) return send(res, 400, { error: 'unknown price' }, cors)
    const customData = txn.custom_data
    const currency = 'USD'
    if (!price.recurring) {
      const entity = transactionEntity(
        null,
        customData,
        currency,
        price.amount,
        'web',
        price.id,
        txn.id,
      )
      remember(entity, price.id)
      await fire('transaction.completed', entity)
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
    const first = transactionEntity(
      sub,
      customData,
      currency,
      price.amount,
      'web',
      price.id,
      txn.id,
    )
    remember(first, price.id)
    await fire('transaction.completed', first)
    await fire('subscription.created', { ...subscriptionEntity(sub), transaction_id: txn.id })
    await fire('subscription.activated', subscriptionEntity(sub))
    return send(res, 200, { ok: true, subscriptionId: sub.id }, cors)
  }

  async function control(res: ServerResponse, patch: Record<string, unknown>) {
    if (patch.refundMode === 'approve' || patch.refundMode === 'pending')
      refundMode = patch.refundMode
    if (patch.decide && typeof patch.decide === 'object') {
      const { id, status } = patch.decide as { id?: string; status?: string }
      const found = [...paid.values()]
        .flatMap((t) => t.adjustments)
        .find((a) => a.id === id && a.status === 'pending_approval')
      if (!found || (status !== 'approved' && status !== 'rejected'))
        return send(res, 404, { error: 'no such pending adjustment' })
      found.status = status
      await fire('adjustment.updated', adjustmentEntity(found))
    }
    if (patch.chargeback && typeof patch.chargeback === 'object') {
      const { transaction, warning } = patch.chargeback as {
        transaction?: string
        warning?: boolean
      }
      const found = paid.get(String(transaction ?? ''))
      if (!found) return send(res, 404, { error: 'no such transaction' })
      const adjustment: FakePaddleAdjustment = {
        id: `adj_${randomUUID().replaceAll('-', '').slice(0, 26)}`,
        action: warning ? 'chargeback_warning' : 'chargeback',
        status: 'approved',
        transactionId: found.id,
        total: found.total,
        currency: found.currency,
      }
      found.adjustments.push(adjustment)
      await fire('adjustment.created', adjustmentEntity(adjustment))
    }
    if (typeof patch.winDispute === 'string') {
      const original = [...paid.values()]
        .flatMap((t) => t.adjustments)
        .find(
          (a) =>
            a.id === patch.winDispute &&
            a.status === 'approved' &&
            a.action.startsWith('chargeback'),
        )
      if (!original) return send(res, 404, { error: 'no such chargeback' })
      original.status = 'reversed'
      const reverse: FakePaddleAdjustment = {
        id: `adj_${randomUUID().replaceAll('-', '').slice(0, 26)}`,
        action: 'chargeback_reverse',
        status: 'approved',
        transactionId: original.transactionId,
        total: original.total,
        currency: original.currency,
      }
      paid.get(original.transactionId)!.adjustments.push(reverse)
      await fire('adjustment.updated', adjustmentEntity(original))
      await fire('adjustment.created', adjustmentEntity(reverse))
    }
    if ('prorationRatio' in patch)
      prorationRatio = typeof patch.prorationRatio === 'number' ? patch.prorationRatio : null
    if (patch.reset) {
      refundMode = 'pending'
      prorationRatio = null
      paid.clear()
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
      const renewal = transactionEntity(
        s,
        s.customData,
        s.currency,
        s.amount,
        'subscription_recurring',
        s.priceId,
      )
      remember(renewal, s.priceId)
      await fire('transaction.completed', renewal)
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
      await fire(
        'subscription.updated',
        subscriptionEntity({ ...s, status: 'active', scheduledCancel: false }),
        new Date(Date.now() - 60 * 60_000),
      )
    }
    return send(res, 200, {
      adjustments: [...paid.values()].flatMap((t) => t.adjustments),
      subscriptions: [...subs.values()],
      calls,
      sent,
      transactions: [...transactions.values()],
    } satisfies FakePaddleState)
  }

  const server: Server = createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => send(res, 500, { error: String(error) }))
  })

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const path = (req.url ?? '/').split('?')[0] as string
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS' })
      return res.end()
    }
    const text = await readBody(req)
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : null
    if (path === '/control')
      return req.method === 'GET' ? control(res, {}) : control(res, body ?? {})
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
      return send(res, 200, { data: { status: 'draft', ...txn } })
    }

    const lookup = /^\/transactions\/([^/]+)$/.exec(path)
    if (lookup && req.method === 'GET') {
      const authorized = req.headers.authorization === `Bearer ${FAKE_PADDLE.apiKey}`
      calls.push({ method: req.method, path, authorized, body })
      if (!authorized) return send(res, 403, { error: { code: 'forbidden' } })
      const found = paid.get(decodeURIComponent(lookup[1] as string))
      if (!found) return send(res, 404, { error: { code: 'not_found' } })
      return send(res, 200, transactionBody(found, (req.url ?? '').includes('include=adjustments')))
    }

    if (path === '/adjustments' && req.method === 'POST') {
      const authorized = req.headers.authorization === `Bearer ${FAKE_PADDLE.apiKey}`
      calls.push({ method: req.method, path, authorized, body })
      if (!authorized) return send(res, 403, { error: { code: 'forbidden' } })
      const found = paid.get(String(body?.transaction_id ?? ''))
      if (!found || body?.action !== 'refund')
        return send(res, 404, { error: { code: 'not_found' } })
      const refused = (status: number, code: string) => send(res, status, { error: { code } })
      if (found.adjustments.some((a) => a.status === 'pending_approval'))
        return refused(409, 'adjustment_pending_refund_request')
      const items = (body?.items as Array<{ amount?: string }> | undefined) ?? []
      const amount =
        body?.type === 'full'
          ? found.total
          : items.reduce((sum, i) => sum + Number(i.amount ?? 0), 0)
      const taken = found.adjustments
        .filter((a) => a.status !== 'rejected')
        .reduce((sum, a) => sum + a.total, 0)
      if (amount <= 0) return refused(400, 'adjustment_amount_cannot_be_zero')
      if (taken + amount > found.total)
        return refused(400, 'adjustment_total_above_remaining_allowed')
      const adjustment: FakePaddleAdjustment = {
        id: `adj_${randomUUID().replaceAll('-', '').slice(0, 26)}`,
        action: 'refund',
        status: refundMode === 'approve' ? 'approved' : 'pending_approval',
        transactionId: found.id,
        total: amount,
        currency: found.currency,
      }
      found.adjustments.push(adjustment)
      await fire('adjustment.created', adjustmentEntity(adjustment))
      return send(res, 201, { data: adjustmentEntity(adjustment) })
    }

    const change = /^\/subscriptions\/([^/]+?)(\/preview)?$/.exec(path)
    if (change && req.method === 'PATCH') {
      const authorized = req.headers.authorization === `Bearer ${FAKE_PADDLE.apiKey}`
      const call: FakePaddleCall = { method: req.method, path, authorized, body }
      calls.push(call)
      if (!authorized) return send(res, 403, { error: { code: 'forbidden' } })
      const s = subs.get(decodeURIComponent(change[1] as string))
      if (!s) return send(res, 404, { error: { code: 'not_found' } })
      const target = Object.values(FAKE_PADDLE.prices).find(
        (p) =>
          p.recurring &&
          p.id === (body?.items as Array<{ price_id?: string }> | undefined)?.[0]?.price_id,
      )
      if (!target || body?.proration_billing_mode !== 'prorated_immediately')
        return send(res, 400, { error: { code: 'invalid_field' } })
      // 일할 - 남은 시간 비율로 새 가격은 청구, 옛 가격은 크레딧
      const left = new Date(s.periodEnd).getTime() - Date.now()
      const ratio =
        prorationRatio ??
        Math.min(
          Math.max(left / (new Date(s.periodEnd).getTime() - new Date(s.periodStart).getTime()), 0),
          1,
        )
      const total = Math.round(target.amount * ratio)
      const credit = Math.round(s.amount * ratio)
      const grand = Math.max(total - credit, 0)
      // 미리보기의 거래 합계는 낼 돈(`grand_total`)뿐이다 - 총액 · 크레딧은 `update_summary` 에만 있다
      call.totals = { total: String(grand), credit: '0', grand_total: String(grand) }
      const period = { starts_at: s.periodStart, ends_at: s.periodEnd }
      const money = (amount: number) => ({ amount: String(amount), currency_code: s.currency })
      if (change[2])
        return send(res, 200, {
          data: {
            ...subscriptionEntity(s),
            immediate_transaction: {
              billing_period: period,
              details: {
                totals: { ...call.totals, currency_code: s.currency },
              },
            },
            recurring_transaction_details: {
              totals: { total: String(target.amount), currency_code: s.currency },
            },
            update_summary: {
              credit: money(-credit),
              charge: money(total),
              result: {
                action: total >= credit ? 'charge' : 'credit',
                amount: String(Math.abs(total - credit)),
              },
            },
          },
        })
      // 실제 응답은 금액 칸이 null 이고 바뀐 품목만 온다
      const before = s.priceId
      s.priceId = target.id
      s.amount = target.amount
      send(res, 200, {
        data: {
          ...subscriptionEntity(s),
          immediate_transaction: null,
          recurring_transaction_details: null,
          update_summary: null,
        },
      })
      // Paddle 은 응답한 뒤 웹훅으로 알린다 - 변경 거래의 total 은 실제 낸 돈(크레딧을 뺀 뒤), credit 은 0, 품목은 새 것 +1 · 옛 것 -1
      const changed = transactionEntity(
        s,
        s.customData,
        s.currency,
        grand,
        'subscription_update',
        target.id,
      )
      const paidChange = {
        ...changed,
        details: {
          ...changed.details,
          line_items: [
            { price_id: target.id, quantity: 1 },
            { price_id: before, quantity: -1 },
          ],
        },
      }
      remember(paidChange, target.id)
      await fire('transaction.completed', paidChange)
      await fire('subscription.updated', subscriptionEntity(s))
      return
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
      await fire(
        s.status === 'canceled' ? 'subscription.canceled' : 'subscription.updated',
        subscriptionEntity(s),
      )
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
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections() // 백엔드(JVM)가 쥔 연결 때문에 닫기가 늦어지지 않게
        server.close(() => done())
      }),
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

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
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

/** Paddle.js 대역 — `PricePreview` 는 가짜 가격표의 달러 표시 금액을 돌려주고, `Checkout.open` 은 이 서버에 결제를 만들게 하고 successUrl 로 돌려보낸다 */
export function fakePaddleSdkScript(fakeUrl: string): string {
  return `(function () {
  var FAKE = ${JSON.stringify(fakeUrl)};
  var token = null;
  var PRICES = ${JSON.stringify(Object.fromEntries(Object.values(FAKE_PADDLE.prices).map((p) => [p.id, { amount: p.amount, recurring: p.recurring }])))};
  window.Paddle = {
    Environment: { set: function () {} },
    Initialize: function (options) { token = options.token; },
    PricePreview: function (request) {
      return Promise.resolve({
        data: {
          details: {
            lineItems: request.items.map(function (item) {
              return {
                price: {
                  id: item.priceId,
                  billingCycle: PRICES[item.priceId].recurring ? { interval: 'month', frequency: 1 } : null
                },
                formattedTotals: { total: '$' + (PRICES[item.priceId].amount / 100).toFixed(2) }
              };
            })
          }
        }
      });
    },
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
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: fakePaddleSdkScript(fakeUrl),
    }),
  )
}
