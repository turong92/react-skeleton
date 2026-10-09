import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PaymentLedgerApi } from './ledgerApi'
import { order } from './test/fixtures'
import { ORDER_POLL_MAX_MS, orderQuery } from './queries'

// TanStack Query 는 모듈을 읽을 때 `window` 가 없으면 서버로 보고 되묻기 타이머를 만들지 않는다
vi.hoisted(() => {
  Object.assign(globalThis, {
    window: { addEventListener: () => undefined, removeEventListener: () => undefined },
  })
})

/** 한 건 조회가 실패하는 때를 섞어 CONFIRMING 을 계속 되묻는 모양을 가짜 시계로 재현한다 */
function watch({
  failOn = [],
  latencyMs = 100,
  maxPollMs,
}: {
  /** 이 번째(1부터) 호출은 오류로 끝난다. `'all-after-first'` 면 첫 답 뒤 전부 */
  failOn?: number[] | 'all-after-first'
  latencyMs?: number
  maxPollMs?: number
}) {
  vi.useFakeTimers()
  const startedAt: number[] = []
  const api = {
    getOrder: async () => {
      const n = startedAt.push(Date.now())
      await new Promise((resolve) => setTimeout(resolve, latencyMs))
      if (failOn === 'all-after-first' ? n > 1 : failOn.includes(n)) throw new Error('network')
      return { order: order({ status: 'CONFIRMING', paidAt: null }), refunds: [] }
    },
  } as unknown as PaymentLedgerApi
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const observer = new QueryObserver(
    client,
    orderQuery(api, 'ord_1', maxPollMs ? { maxPollMs } : {}) as never,
  )
  const stop = observer.subscribe(() => undefined)
  const gaps = () => startedAt.slice(1).map((at, i) => at - (startedAt[i] as number))
  return { startedAt, gaps, stop }
}

describe('asking again while CONFIRMING when the answers themselves can fail', () => {
  afterEach(() => vi.useRealTimers())

  it('stops asking at the cap even if every later answer is an error (the cap is a clock, not the age of the last good answer)', async () => {
    const w = watch({ failOn: 'all-after-first', maxPollMs: 5_000 })
    await vi.advanceTimersByTimeAsync(60_000)
    const asked = w.startedAt.length
    expect(asked).toBeGreaterThan(1)
    expect(asked).toBeLessThan(10)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(w.startedAt.length).toBe(asked)
    w.stop()
  })

  it('one failed answer on the 10 s stretch neither sends the gap back to 1 s nor restarts the clock', async () => {
    const maxPollMs = 120_000
    const w = watch({ failOn: [8], maxPollMs })
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    const gaps = w.gaps()
    // the gaps grow 1, 2, 4, 8 s and then stay at the cap — the failed call (#8) and what follows it included
    expect(gaps.slice(0, 4).map((g) => Math.round(g / 100))).toEqual(
      [10, 20, 40, 80].map((n) => n + 1),
    )
    expect(gaps.slice(4).every((g) => g >= ORDER_POLL_MAX_MS)).toBe(true)
    // and the whole conversation ends once the cap has passed since the first answer
    const first = w.startedAt[0] as number
    const last = w.startedAt.at(-1) as number
    expect(last - first).toBeLessThanOrEqual(maxPollMs + ORDER_POLL_MAX_MS + 1_000)
    w.stop()
  })
})
