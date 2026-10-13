import { ApiRequestError } from '@skeleton/api-client'
import type { BillingAuth, StartSubscriptionResult } from '@skeleton/payment'
import { describe, expect, it } from 'vitest'
import {
  claimActivation,
  returnPlanOf,
  startFailureOf,
  startSubscribe,
  subscribeReturnUrls,
  type StartSubscribeDeps,
} from './subscribeFlow'

const billingAuth: BillingAuth = {
  provider: 'toss',
  kind: 'TOSS_BILLING_AUTH',
  testMode: true,
  clientKey: 'test_ck_x',
  customerKey: 'cus_1',
  attributes: {},
}
const started = (auth: BillingAuth | null) =>
  ({ subscription: { id: 'sub_1' }, billingAuth: auth }) as unknown as StartSubscriptionResult

function fakes(
  over: { start?: () => Promise<StartSubscriptionResult>; open?: () => Promise<void> } = {},
) {
  const log: string[] = []
  const opened: unknown[] = []
  const deps: StartSubscribeDeps = {
    start: over.start ?? (async () => started(billingAuth)),
    openBillingAuth: async (...args) => {
      log.push('open')
      opened.push(args)
      await over.open?.()
    },
    urlsFor: (id) => subscribeReturnUrls('https://app.example', id),
  }
  return { deps, log, opened }
}

const apiError = (code: string, status: number) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't' }, 'tr', 'sp', 'tp')

describe('subscribeReturnUrls', () => {
  it('both addresses come back to one screen and carry our subscription id (the card window only adds authKey/customerKey)', () => {
    expect(subscribeReturnUrls('https://app.example/', 'sub_1')).toEqual({
      successUrl: 'https://app.example/subscriptions/return?sub=sub_1',
      failUrl: 'https://app.example/subscriptions/return?sub=sub_1',
    })
  })
})

describe('startSubscribe', () => {
  it("hands only the plan to the server - provider and country are the server's to decide", async () => {
    const seen: unknown[][] = []
    const { deps } = fakes()
    deps.start = async (...args) => {
      seen.push(args)
      return started(billingAuth)
    }
    await startSubscribe(deps, 'basic')
    expect(seen).toEqual([['basic']])
  })

  it('starts the subscription, then opens the card window with the server values and our return addresses', async () => {
    const { deps, opened } = fakes()
    await expect(startSubscribe(deps, 'basic')).resolves.toEqual({ kind: 'opened' })
    expect(opened[0]).toEqual([
      billingAuth,
      {
        successUrl: 'https://app.example/subscriptions/return?sub=sub_1',
        failUrl: 'https://app.example/subscriptions/return?sub=sub_1',
      },
    ])
  })

  it('the server refusing the start never opens a window', async () => {
    const error = apiError('PAYMENT.ALREADY_SUBSCRIBED', 409)
    const { deps, log } = fakes({
      start: async () => {
        throw error
      },
    })
    await expect(startSubscribe(deps, 'basic')).resolves.toEqual({ kind: 'start-failed', error })
    expect(log).toEqual([])
  })

  it('a card that was already registered (the same key sent again) has no window to open — it is not a failure', async () => {
    const { deps, log } = fakes({ start: async () => started(null) })
    await expect(startSubscribe(deps, 'basic')).resolves.toEqual({ kind: 'settled' })
    expect(log).toEqual([])
  })

  it.each(['USER_CANCEL', 'PAY_PROCESS_CANCELED'])(
    'closing the window (%s) is not an error',
    async (code) => {
      const { deps } = fakes({
        open: async () => {
          throw Object.assign(new Error('closed'), { code })
        },
      })
      await expect(startSubscribe(deps, 'basic')).resolves.toEqual({ kind: 'canceled' })
    },
  )

  it('a window that could not open is reported with its error', async () => {
    const error = new Error('script blocked')
    const { deps } = fakes({
      open: async () => {
        throw error
      },
    })
    await expect(startSubscribe(deps, 'basic')).resolves.toEqual({ kind: 'window-failed', error })
  })
})

describe('startFailureOf — what the page says when the start was refused', () => {
  it('names the three cases the person can act on, and a general one', () => {
    expect(startFailureOf(apiError('PAYMENT.ALREADY_SUBSCRIBED', 409))).toBe('already')
    expect(startFailureOf(apiError('PAYMENT.UNAVAILABLE', 503))).toBe('unavailable')
    expect(startFailureOf(apiError('COMMON.TOO_MANY_REQUESTS', 429))).toBe('rateLimited')
    expect(startFailureOf(apiError('PAYMENT.ITEM_NOT_PURCHASABLE', 422))).toBe('failed')
    expect(startFailureOf(new Error('x'))).toBe('failed')
  })
})

describe('returnPlanOf — what the address the card window sent us back to asks the screen to do', () => {
  it('success: activate our subscription with the authKey', () => {
    expect(returnPlanOf('?sub=sub_1&customerKey=cus_1&authKey=bk_1')).toEqual({
      kind: 'activate',
      id: 'sub_1',
      authKey: 'bk_1',
    })
  })

  it('failure: left, and says whether the person closed the window', () => {
    expect(returnPlanOf('?sub=sub_1&code=PAY_PROCESS_CANCELED&message=x')).toEqual({
      kind: 'left',
      canceled: true,
    })
    expect(returnPlanOf('?sub=sub_1&code=INVALID_CARD&message=x')).toEqual({
      kind: 'left',
      canceled: false,
    })
  })

  it('a success address without our id, or an address that says neither, cannot be read', () => {
    expect(returnPlanOf('?authKey=bk_1')).toEqual({ kind: 'invalid' })
    expect(returnPlanOf('')).toEqual({ kind: 'invalid' })
  })
})

describe('claimActivation — one activate per authKey while this page lives (StrictMode, back and forward)', () => {
  it('lets the first claim of a key through and refuses the rest', () => {
    expect(claimActivation('sub_1', 'bk_once')).toBe(true)
    expect(claimActivation('sub_1', 'bk_once')).toBe(false)
    expect(claimActivation('sub_1', 'bk_other')).toBe(true)
    expect(claimActivation('sub_2', 'bk_once')).toBe(true)
  })
})

describe('paddle (the first payment comes by webhook)', () => {
  it('comes back with the subscription id and the page only watches the subscription', () => {
    expect(subscribeReturnUrls('https://app.example', 'sub_1', 'paddle').successUrl).toBe(
      'https://app.example/subscriptions/return?sub=sub_1&provider=paddle',
    )
    expect(returnPlanOf('?sub=sub_1&provider=paddle')).toEqual({ kind: 'watch', id: 'sub_1' })
  })
})
