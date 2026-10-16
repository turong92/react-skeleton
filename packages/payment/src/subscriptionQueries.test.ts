import { ApiRequestError } from '@skeleton/api-client'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { createIntentKeys } from './intentKeys'
import { ORDER_POLL_MAX_DURATION_MS, ORDER_POLL_MIN_MS, paymentKeys } from './queries'
import type { PaymentSubscriptionApi } from './subscriptionApi'
import {
  activateSubscriptionMutation,
  cancelNowMutation,
  cancelSubscriptionMutation,
  changePlanMutation,
  mySubscriptionQuery,
  startSubscriptionMutation,
  subscriptionPlansQuery,
} from './subscriptionQueries'
import type { Subscription } from './subscriptionTypes'
import { subscription } from './test/fixtures'
import { statusWhileReReading } from './test/refetchGuard'

// TanStack Query 는 모듈을 읽을 때 `window` 가 없으면 서버로 보고 되묻기 타이머를 만들지 않는다 — 읽기 전에 가짜 window 를 세운다
vi.hoisted(() => {
  Object.assign(globalThis, {
    window: { addEventListener: () => undefined, removeEventListener: () => undefined },
  })
})

function fakeApi() {
  const calls: Array<[string, ...unknown[]]> = []
  const api: PaymentSubscriptionApi = {
    plans: async () => {
      calls.push(['plans'])
      return []
    },
    start: async (input, options) => {
      calls.push(['start', input, options])
      return { subscription: subscription({ status: 'PENDING' }), billingAuth: null }
    },
    activate: async (id, input) => {
      calls.push(['activate', id, input])
      return subscription()
    },
    me: async () => {
      calls.push(['me'])
      return { subscription: subscription(), orders: [] }
    },
    cancel: async (id) => {
      calls.push(['cancel', id])
      return subscription({ status: 'CANCELING' })
    },
    cancelPreview: async (id) => {
      calls.push(['cancelPreview', id])
      throw new Error('not used')
    },
    cancelNow: async (id) => {
      calls.push(['cancelNow', id])
      return {
        subscription: subscription({ status: 'ENDED', endReason: 'USER_CANCELED_NOW' }),
        refund: { amount: 0, currency: 'KRW' },
        withdrawal: false,
        lines: [],
        refunds: [],
      }
    },
    changePreview: async (id, planCode) => {
      calls.push(['changePreview', id, planCode])
      throw new Error('not used')
    },
    changePlan: async (id, input, options) => {
      calls.push(['changePlan', id, input, options])
      return subscription({ planCode: input.planCode })
    },
  }
  return { api, calls }
}

const apiError = (code: string, status: number) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't' }, 'tr', 'sp', 'tp')

describe('changePlanMutation - one Idempotency-Key per attempt at the same change', () => {
  async function pressTwice(failure: Error | null) {
    const { api, calls } = fakeApi()
    const client = new QueryClient()
    const keys = createIntentKeys()
    api.changePlan = async (id, input, options) => {
      calls.push(['changePlan', id, input, options])
      if (failure) throw failure
      return subscription({ planCode: input.planCode })
    }
    const observer = new MutationObserver<
      unknown,
      Error,
      { id: string; planCode: string; expectedCharge: number }
    >(client, changePlanMutation(api, client, keys) as never)
    const vars = { id: 'sub_1', planCode: 'pro', expectedCharge: 1500 }
    await observer.mutate(vars).catch(() => undefined)
    await observer.mutate(vars).catch(() => undefined)
    return calls.map((call) => (call[3] as { idempotencyKey: string }).idempotencyKey)
  }

  it('a lost answer is sent again with the same key (the server charges once)', async () => {
    const [first, second] = await pressTwice(new Error('lost'))
    expect(first).toBe(second)
  })

  it('a definite refusal frees the key, so pressing again is a new attempt and not a replay of the refused one', async () => {
    const [first, second] = await pressTwice(apiError('PAYMENT.DECLINED', 402))
    expect(first).not.toBe(second)
  })
})

describe('subscription keys sit under the one payment root', () => {
  it('so a single invalidation of the root re-reads plans and my subscription too', () => {
    expect(paymentKeys.subscriptionPlans().slice(0, 1)).toEqual(['payment'])
    expect(paymentKeys.mySubscription().slice(0, 1)).toEqual(['payment'])
    expect(paymentKeys.subscriptionPlans()).not.toEqual(paymentKeys.mySubscription())
  })
})

describe('mySubscriptionQuery — ask again only while the first payment is being checked (PENDING)', () => {
  const interval = (status: Subscription['status'] | null, dataUpdatedAt = Date.now()) =>
    mySubscriptionQuery(fakeApi().api).refetchInterval({
      state: {
        data: status ? { subscription: subscription({ status }), orders: [] } : undefined,
        dataUpdatedAt,
        errorUpdatedAt: 0,
      },
    } as never)

  it('PENDING is asked again; every other state, no subscription and nothing loaded are not', () => {
    expect(interval('PENDING')).toBe(ORDER_POLL_MIN_MS)
    for (const status of ['ACTIVE', 'PAST_DUE', 'CANCELING', 'ENDED'] as const)
      expect(interval(status), status).toBe(false)
    expect(interval(null, 0)).toBe(false)
  })

  it('stops after the poll limit instead of asking forever', () => {
    const old = Date.now() - ORDER_POLL_MAX_DURATION_MS - 1
    expect(interval('PENDING', old)).toBe(false)
  })

  it('plans and me call the api once', async () => {
    const { api, calls } = fakeApi()
    await subscriptionPlansQuery(api).queryFn()
    await mySubscriptionQuery(api).queryFn()
    expect(calls).toEqual([['plans'], ['me']])
  })
})

describe('mySubscriptionQuery with subscriptionId — wait for the subscription just started, not an older one', () => {
  const interval = (id: string, read: Partial<Subscription> | null) =>
    mySubscriptionQuery(fakeApi().api, { subscriptionId: id }).refetchInterval({
      state: {
        data: { subscription: read ? subscription(read) : null, orders: [] },
        dataUpdatedAt: Date.now(),
        errorUpdatedAt: 0,
      },
    } as never)

  it('keeps asking while "me" still shows another (older, ENDED) subscription', () => {
    expect(interval('new', { id: 'old', status: 'ENDED' })).toBe(ORDER_POLL_MIN_MS)
    expect(interval('new', { id: 'old', status: 'ACTIVE' })).toBe(ORDER_POLL_MIN_MS)
    expect(interval('new', null)).toBe(ORDER_POLL_MIN_MS)
  })

  it('stops once that very subscription is settled (ACTIVE, or ENDED for good); PENDING is asked again', () => {
    expect(interval('new', { id: 'new', status: 'ACTIVE' })).toBe(false)
    expect(interval('new', { id: 'new', status: 'ENDED' })).toBe(false)
    expect(interval('new', { id: 'new', status: 'PENDING' })).toBe(ORDER_POLL_MIN_MS)
  })
})

describe('mutations', () => {
  async function run(
    build: (api: PaymentSubscriptionApi, client: QueryClient) => unknown,
    vars: unknown,
  ) {
    const { api, calls } = fakeApi()
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    await new MutationObserver(client, build(api, client) as never).mutate(vars as never)
    return { calls, invalidated: spy.mock.calls.map(([filters]) => filters?.queryKey) }
  }

  it('start sends the plan with the idempotency key apart from it and leaves the caches alone (a PENDING attempt is in no list)', async () => {
    const { calls, invalidated } = await run(startSubscriptionMutation, {
      planCode: 'basic',
      idempotencyKey: 'k-1',
    })
    expect(calls).toEqual([['start', { planCode: 'basic' }, { idempotencyKey: 'k-1' }]])
    expect(invalidated).toEqual([])
  })

  it('start: the same plan twice carries the same key until it succeeds', async () => {
    const { api, calls } = fakeApi()
    const keys = createIntentKeys()
    const client = new QueryClient()
    const options = startSubscriptionMutation(api, client, keys)
    api.start = async (input, o) => {
      calls.push(['start', input, o])
      throw new Error('lost')
    }
    const observer = new MutationObserver<unknown, Error, { planCode: string }>(
      client,
      options as never,
    )
    await observer.mutate({ planCode: 'basic' }).catch(() => undefined)
    await observer.mutate({ planCode: 'basic' }).catch(() => undefined)
    const used = calls.map((call) => (call[2] as { idempotencyKey: string }).idempotencyKey)
    expect(used[0]).toBe(used[1])
  })

  it('activate / cancel call the api and invalidate the root', async () => {
    const activate = await run(activateSubscriptionMutation, { id: 'sub_1', authKey: 'bk_1' })
    expect(activate.calls).toEqual([
      ['activate', 'sub_1', { providerPayload: { authKey: 'bk_1' } }],
    ])
    expect(activate.invalidated).toEqual([paymentKeys.all])
    const cancel = await run(cancelSubscriptionMutation, 'sub_1')
    expect(cancel.calls).toEqual([['cancel', 'sub_1']])
    expect(cancel.invalidated).toEqual([paymentKeys.all])
  })

  it('a failed activate or cancel still invalidates (a 402 or a lost answer: the server may have moved on)', async () => {
    for (const [build, method, vars, error] of [
      [
        activateSubscriptionMutation,
        'activate',
        { id: 's', authKey: 'a' },
        apiError('PAYMENT.DECLINED', 402),
      ],
      [
        cancelSubscriptionMutation,
        'cancel',
        's',
        apiError('PAYMENT.SUBSCRIPTION_NOT_CANCELABLE', 409),
      ],
    ] as const) {
      const { api } = fakeApi()
      api[method] = async () => {
        throw error
      }
      const client = new QueryClient()
      const spy = vi.spyOn(client, 'invalidateQueries')
      await expect(
        new MutationObserver(client, build(api, client) as never).mutate(vars as never),
      ).rejects.toThrow()
      expect(spy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([paymentKeys.all])
    }
  })

  it('activate sends again only when it does not know the result, never after a verdict', () => {
    const { api } = fakeApi()
    const { retry } = activateSubscriptionMutation(api, new QueryClient())
    expect(retry(0, new Error('network'))).toBe(true)
    expect(retry(5, new Error('network'))).toBe(false)
    expect(retry(0, apiError('PAYMENT.DECLINED', 402))).toBe(false)
    expect(retry(0, apiError('PAYMENT.SUBSCRIPTION_NOT_ACTIVATABLE', 409))).toBe(false)
  })

  it('a change stays pending until the re-read it started has finished (no second action from a stale screen)', async () => {
    const { api } = fakeApi()
    for (const make of [
      (client: QueryClient) => [cancelSubscriptionMutation(api, client), 'sub_1'] as const,
      (client: QueryClient) =>
        [activateSubscriptionMutation(api, client), { id: 'sub_1', authKey: 'a' }] as const,
    ]) {
      const client = new QueryClient()
      const [options, vars] = make(client)
      expect(await statusWhileReReading(client, options as never, vars as never)).toEqual({
        whileReading: 'pending',
        after: 'success',
      })
    }
  })
})

describe('cancelNowMutation', () => {
  it('asks the api once for the subscription id and refreshes the payment cache either way', async () => {
    const { api, calls } = fakeApi()
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const observer = new MutationObserver<unknown, Error, string>(
      client,
      cancelNowMutation(api, client),
    )
    await observer.mutate('sub_1')
    expect(calls).toEqual([['cancelNow', 'sub_1']])
    expect(invalidate).toHaveBeenCalled()
  })
})
