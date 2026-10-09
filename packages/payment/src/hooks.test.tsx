import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Order } from './ledgerTypes'
import {
  useAbandonOrder,
  useConfirmOrder,
  useCreateOrder,
  useOrder,
  useOrders,
  usePaymentConfig,
  useRequestRefund,
  useWithdrawRefund,
} from './hooks'
import type { PaymentLedgerApi } from './ledgerApi'
import { paymentKeys } from './queries'

const api = {} as PaymentLedgerApi

function render(client: QueryClient, ui: () => string) {
  let out = ''
  function Probe() {
    out = ui()
    return null
  }
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  )
  return out
}

describe('hooks are thin wrappers over the query definitions', () => {
  it('usePaymentConfig / useOrder read what is cached under the shared keys', () => {
    const client = new QueryClient()
    client.setQueryData(paymentKeys.config(), { available: true })
    client.setQueryData(paymentKeys.order('ord_1'), { order: { id: 'ord_1' }, refunds: [] })
    expect(render(client, () => JSON.stringify(usePaymentConfig(api).data))).toBe(
      '{"available":true}',
    )
    expect(
      render(client, () => (useOrder(api, 'ord_1').data as { order: { id: string } }).order.id),
    ).toBe('ord_1')
  })

  it('useOrder does not fetch without an id', () => {
    const client = new QueryClient()
    expect(render(client, () => useOrder(api, undefined).fetchStatus)).toBe('idle')
  })

  it('useOrders is an infinite query; the mutation hooks start idle', () => {
    const client = new QueryClient()
    expect(render(client, () => String(useOrders(api).hasNextPage))).toBe('false')
    const page = (nextCursor: string | null, hasNext: boolean) => ({
      values: [],
      cursor: { nextCursor, hasNext },
      meta: { timestamp: 't' },
    })
    client.setQueryData(paymentKeys.orderList({ size: 5 }), {
      pages: [page('c2', true)],
      pageParams: [undefined],
    })
    expect(render(client, () => String(useOrders(api, { size: 5 }).hasNextPage))).toBe('true')
    client.setQueryData(paymentKeys.orderList({ size: 6 }), {
      pages: [page(null, false)],
      pageParams: [undefined],
    })
    expect(render(client, () => String(useOrders(api, { size: 6 }).hasNextPage))).toBe('false')
    for (const use of [
      useCreateOrder,
      useConfirmOrder,
      useAbandonOrder,
      useRequestRefund,
      useWithdrawRefund,
    ])
      expect(render(client, () => use(api).status)).toBe('idle')
  })
})

/** 실제 훅을 한 번 그려 변경 함수만 꺼내 부른다(서버 렌더에서도 mutateAsync 는 돈다) */
function mount<T>(use: () => T): T {
  let captured: T | undefined
  render(new QueryClient(), () => {
    captured = use()
    return ''
  })
  return captured as T
}

const placed = { order: {} as Order, checkout: {} as never }

describe('useCreateOrder holds the Idempotency-Key of one intent', () => {
  function setup(fail = false) {
    const keys: Array<string | undefined> = []
    const fake = {
      createOrder: async (_input: unknown, options?: { idempotencyKey?: string }) => {
        keys.push(options?.idempotencyKey)
        if (fail) throw new Error('network')
        return placed
      },
    } as unknown as PaymentLedgerApi
    return { keys, hook: mount(() => useCreateOrder(fake)) }
  }
  const cheer = { itemType: 'cheer', itemRef: 'cheer-3000' }

  it('two presses of the same item send the same key — after success the next press gets a new one', async () => {
    const { keys, hook } = setup()
    await hook.mutateAsync(cheer)
    await hook.mutateAsync(cheer)
    expect(keys[0]).toMatch(/^fe-/)
    expect(keys[1]).not.toBe(keys[0])
  })

  it('a failed press (network error) is retried with the same key', async () => {
    const { keys, hook } = setup(true)
    await expect(hook.mutateAsync(cheer)).rejects.toThrow('network')
    await expect(hook.mutateAsync(cheer)).rejects.toThrow('network')
    expect(keys[0]).toMatch(/^fe-/)
    expect(keys[1]).toBe(keys[0])
  })

  it('another item is another intent: new key; coming back to the first item does not resurrect the old key', async () => {
    const { keys, hook } = setup(true)
    await hook.mutateAsync(cheer).catch(() => undefined)
    await hook.mutateAsync({ ...cheer, itemRef: 'cheer-5000' }).catch(() => undefined)
    await hook.mutateAsync({ ...cheer, quantity: 2 }).catch(() => undefined)
    expect(new Set(keys).size).toBe(3)
  })

  it('quantity 1 and an omitted quantity are the same intent only when written the same (no guessing)', async () => {
    const { keys, hook } = setup(true)
    await hook.mutateAsync({ ...cheer, quantity: 1 }).catch(() => undefined)
    await hook.mutateAsync({ ...cheer, quantity: 1 }).catch(() => undefined)
    expect(keys[1]).toBe(keys[0])
  })

  it('an explicit key wins and is passed through untouched', async () => {
    const { keys, hook } = setup()
    await hook.mutateAsync({ ...cheer, idempotencyKey: 'mine' })
    expect(keys).toEqual(['mine'])
  })
})

describe('useRequestRefund holds the Idempotency-Key of one intent', () => {
  function setup(fail = false) {
    const keys: Array<string | undefined> = []
    const fake = {
      requestRefund: async (
        _id: string,
        _input: unknown,
        options?: { idempotencyKey?: string },
      ) => {
        keys.push(options?.idempotencyKey)
        if (fail) throw new Error('network')
        return { id: 'rfd_1', status: 'REQUESTED' } as never
      },
    } as unknown as PaymentLedgerApi
    return { keys, hook: mount(() => useRequestRefund(fake)) }
  }
  const request = { orderId: 'ord_1', reasonCode: 'CUSTOMER_REQUEST' as const, amount: 1000 }

  it('a repeated press of the same refund keeps the key while it keeps failing, and renews it after success', async () => {
    const failing = setup(true)
    await failing.hook.mutateAsync(request).catch(() => undefined)
    await failing.hook.mutateAsync(request).catch(() => undefined)
    expect(failing.keys[1]).toBe(failing.keys[0])

    const ok = setup()
    await ok.hook.mutateAsync(request)
    await ok.hook.mutateAsync(request)
    expect(ok.keys[1]).not.toBe(ok.keys[0])
  })

  it('another order, reason or amount is another intent; an explicit key wins', async () => {
    const { keys, hook } = setup(true)
    await hook.mutateAsync(request).catch(() => undefined)
    await hook.mutateAsync({ ...request, orderId: 'ord_2' }).catch(() => undefined)
    await hook.mutateAsync({ ...request, reasonCode: 'DUPLICATE' }).catch(() => undefined)
    await hook.mutateAsync({ ...request, amount: 500 }).catch(() => undefined)
    expect(new Set(keys).size).toBe(4)
    await hook.mutateAsync({ ...request, idempotencyKey: 'mine' }).catch(() => undefined)
    expect(keys.at(-1)).toBe('mine')
  })
})

describe('useAbandonOrder', () => {
  it('abandons the given order id', async () => {
    const seen: string[] = []
    const fake = {
      abandonOrder: async (id: string) => {
        seen.push(id)
        return {} as Order
      },
    } as unknown as PaymentLedgerApi
    await mount(() => useAbandonOrder(fake)).mutateAsync('ord_9')
    expect(seen).toEqual(['ord_9'])
  })
})
