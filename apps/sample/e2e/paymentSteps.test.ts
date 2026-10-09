/// <reference types="node" />
import { readFileSync } from 'node:fs'
import type { Page } from 'playwright/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * 결제 e2e 의 도우미가 제 일을 하는지 — 브라우저 · 백엔드 없이 본다(진짜 e2e 는 백엔드가 있어야 돈다).
 * 화면 로그인은 한 페이지에 한 번만(두 번째부터는 「로그인」 링크가 없어 던진다), 탐침은 「이 백엔드엔 없다(404)」만 건너뜀으로 바꾸고 그 밖의 실패는 던진다.
 */
const signIn = vi.fn(async () => undefined)
vi.mock('./helpers', () => ({
  DEMO: { email: 'user@example.com', password: 'password' },
  ko: (key: string) => key,
  consentViaApi: async () => undefined,
  signIn: (...args: unknown[]) => (signIn as (...a: unknown[]) => Promise<void>)(...args),
}))

const answers = (routes: Record<string, number>) =>
  vi.fn(async (url: string) => {
    const path = new URL(url).pathname.replace('/api/v1', '')
    const status = routes[path]
    if (status === undefined) throw new Error(`no route for ${path}`)
    const body = path === '/auth/login' ? { value: { accessToken: 'tok' } } : { values: [] }
    return new Response(JSON.stringify(body), { status })
  })

async function steps() {
  vi.resetModules()
  return await import('./paymentSteps')
}

beforeEach(() => signIn.mockClear())
afterEach(() => vi.unstubAllGlobals())

describe('ensureSignedIn — the scenarios of one file share one page', () => {
  it('signs in the first time only; a second scenario on the same page does not look for a 「로그인」 link that is gone', async () => {
    const { ensureSignedIn } = await steps()
    const page = {} as Page
    await ensureSignedIn(page, 'http://app')
    await ensureSignedIn(page, 'http://app')
    expect(signIn).toHaveBeenCalledTimes(1)
  })

  it('another page (another browser) signs in on its own', async () => {
    const { ensureSignedIn } = await steps()
    await ensureSignedIn({} as Page, 'http://app')
    await ensureSignedIn({} as Page, 'http://app')
    expect(signIn).toHaveBeenCalledTimes(2)
  })

  it('a sign-in that threw is not remembered — the next scenario tries again', async () => {
    const { ensureSignedIn } = await steps()
    const page = {} as Page
    signIn.mockRejectedValueOnce(new Error('boom'))
    await expect(ensureSignedIn(page, 'http://app')).rejects.toThrow('boom')
    await ensureSignedIn(page, 'http://app')
    expect(signIn).toHaveBeenCalledTimes(2)
  })
})

describe('paymentOn — skip only when the backend has no cheering', () => {
  it('true when the cheer options answer 200', async () => {
    vi.stubGlobal('fetch', answers({ '/auth/login': 200, '/cheers/options': 200 }))
    expect(await (await steps()).paymentOn('http://api')).toBe(true)
  })

  it('false (skip) when the backend does not have it — 404', async () => {
    vi.stubGlobal('fetch', answers({ '/auth/login': 200, '/cheers/options': 404 }))
    expect(await (await steps()).paymentOn('http://api')).toBe(false)
  })

  it('a broken cheering API (500) is a failure, not a quiet skip', async () => {
    vi.stubGlobal('fetch', answers({ '/auth/login': 200, '/cheers/options': 500 }))
    await expect((await steps()).paymentOn('http://api')).rejects.toThrow(/500/)
  })

  it('a login that fails is a failure, not a quiet skip', async () => {
    vi.stubGlobal('fetch', answers({ '/auth/login': 401, '/cheers/options': 200 }))
    await expect((await steps()).paymentOn('http://api')).rejects.toThrow(/401/)
  })

  it('a backend that cannot be reached is a failure, not a quiet skip', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    await expect((await steps()).paymentOn('http://api')).rejects.toThrow('fetch failed')
  })
})

describe('adminPaymentsOn — the operator routes closed (404) skip the operator scenarios, anything else breaks them', () => {
  const refunds = '/admin/payments/refunds'
  it('true on 200, false on 404', async () => {
    vi.stubGlobal('fetch', answers({ '/auth/login': 200, [refunds]: 200 }))
    expect(await (await steps()).adminPaymentsOn('http://api')).toBe(true)
    vi.stubGlobal('fetch', answers({ '/auth/login': 200, [refunds]: 404 }))
    expect(await (await steps()).adminPaymentsOn('http://api')).toBe(false)
  })

  it('403 (the seeded administrator is not one) and 500 are failures', async () => {
    for (const status of [403, 500]) {
      vi.stubGlobal('fetch', answers({ '/auth/login': 200, [refunds]: status }))
      await expect((await steps()).adminPaymentsOn('http://api')).rejects.toThrow(String(status))
    }
  })
})

describe('the payment e2e files', () => {
  it('log in through ensureSignedIn only (a bare signIn per scenario fails from the second one on)', () => {
    for (const file of ['payment.e2e.ts', 'paymentAdmin.e2e.ts']) {
      const text = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
      expect(text, file).not.toMatch(/\bsignIn\(page/)
      expect(text, file).toMatch(/\bensureSignedIn\(page/)
    }
  })
})
