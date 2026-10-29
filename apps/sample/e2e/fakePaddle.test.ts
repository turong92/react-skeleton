import { createServer } from 'node:http'
import { afterAll, describe, expect, it } from 'vitest'
import { FAKE_PADDLE, paddleControl, paddleSignature, startFakePaddle } from './fakePaddle'

describe('paddleSignature', () => {
  it('is the documented header: ts and the HMAC-SHA256 of "<ts>:<body>"', () => {
    const header = paddleSignature('{"a":1}', 'secret', 1700000000)
    expect(header).toMatch(/^ts=1700000000;h1=[0-9a-f]{64}$/)
    expect(paddleSignature('{"a":1} ', 'secret', 1700000000)).not.toBe(header)
    expect(paddleSignature('{"a":1}', 'other', 1700000000)).not.toBe(header)
  })
})

describe('plan change', () => {
  type Totals = { total: string; credit: string; grand_total: string }
  const received: Array<{
    event_type: string
    data: { origin?: string; items?: unknown; details: { totals: Totals } }
  }> = []
  const backend = createServer((req, res) => {
    let text = ''
    req.on('data', (chunk: Buffer) => (text += chunk.toString()))
    req.on('end', () => {
      received.push(JSON.parse(text))
      res.writeHead(200).end()
    })
  })
  afterAll(() => backend.close())

  const auth = { Authorization: `Bearer ${FAKE_PADDLE.apiKey}`, 'Content-Type': 'application/json' }
  const change = (url: string, id: string, priceId: string, mode: string, preview = false) =>
    fetch(`${url}/subscriptions/${id}${preview ? '/preview' : ''}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        proration_billing_mode: mode,
      }),
    })

  it('previews and applies a plan change with the proration mode it was sent', async () => {
    await new Promise<void>((done) => backend.listen(0, '127.0.0.1', done))
    const fake = await startFakePaddle()
    try {
      fake.setBackend(`http://127.0.0.1:${(backend.address() as { port: number }).port}`)
      const control = paddleControl(fake.url)
      // 구독 하나: 거래를 만들고 결제창 대역이 결제한다
      const txn = (await (
        await fetch(`${fake.url}/transactions`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ items: [{ price_id: 'pri_e2e_basic', quantity: 1 }] }),
        })
      ).json()) as { data: { id: string } }
      await fetch(`${fake.url}/sdk/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: FAKE_PADDLE.clientToken, transactionId: txn.data.id }),
      })
      const sub = (await control.state()).subscriptions[0]!
      await control.set({ prorationRatio: 0.5 })
      received.length = 0

      // 미리보기 - 적용하지 않고 일할: 새 가격 500 × 0.5, 옛 가격 300 × 0.5
      const preview = (await (
        await change(fake.url, sub.id, 'pri_e2e_standard', 'prorated_immediately', true)
      ).json()) as {
        data: {
          immediate_transaction: { details: { totals: Totals } }
          update_summary: { credit: { amount: string } }
          recurring_transaction_details: { totals: { total: string } }
        }
      }
      expect(preview.data.immediate_transaction.details.totals).toMatchObject({
        total: '250',
        credit: '150',
        grand_total: '100',
      })
      expect(preview.data.update_summary.credit.amount).toBe('150')
      expect(preview.data.recurring_transaction_details.totals.total).toBe('500')
      expect((await control.state()).subscriptions[0]!.priceId).toBe('pri_e2e_basic')
      expect(received).toHaveLength(0)

      // 다른 청구 방식은 받지 않는다
      expect((await change(fake.url, sub.id, 'pri_e2e_pro', 'do_not_bill')).status).toBe(400)

      // 실행 - 구독이 바뀌고, 변경 거래(크레딧 포함)와 새 품목의 구독 웹훅이 나간다. 보낸 청구 방식이 호출에 남는다
      expect(
        (await change(fake.url, sub.id, 'pri_e2e_standard', 'prorated_immediately')).status,
      ).toBe(200)
      await expect.poll(() => received.length).toBe(2)
      const paid = received.find((e) => e.event_type === 'transaction.completed')!
      expect(paid.data.origin).toBe('subscription_update')
      expect(paid.data.details.totals).toMatchObject({
        total: '250',
        credit: '150',
        grand_total: '100',
      })
      const updated = received.find((e) => e.event_type === 'subscription.updated')!
      expect(updated.data.items).toEqual([{ price: { id: 'pri_e2e_standard' }, quantity: 1 }])
      const state = await control.state()
      expect(state.subscriptions[0]).toMatchObject({ priceId: 'pri_e2e_standard', amount: 500 })
      expect(
        state.calls
          .filter((c) => c.method === 'PATCH')
          .map((c) => (c.body as { proration_billing_mode: string }).proration_billing_mode),
      ).toEqual(['prorated_immediately', 'do_not_bill', 'prorated_immediately'])
    } finally {
      await fake.close()
    }
  })
})
