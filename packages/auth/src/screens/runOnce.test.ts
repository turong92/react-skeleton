import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOnceRunner } from './runOnce'

afterEach(() => vi.useRealTimers())

describe('createOnceRunner — one send per one-time token, per route set (no module-wide state)', () => {
  it('callers that overlap share the one in-flight call and its result', async () => {
    const once = createOnceRunner()
    const call = vi.fn(async () => 'ok')
    const [a, b] = await Promise.all([once('magic-link:t1', call), once('magic-link:t1', call)])
    expect([a, b]).toEqual(['ok', 'ok'])
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('after a success a remounted screen is told it is done — the result (tokens) is not kept', async () => {
    const once = createOnceRunner()
    const call = vi.fn(async () => ({ accessToken: 'secret' }))
    await once('magic-link:t2', call)
    const again = await once('magic-link:t2', call)
    expect(again).toBeUndefined()
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('a failure is shared only while in flight, then forgotten: a transient network failure can be retried', async () => {
    const once = createOnceRunner()
    let attempt = 0
    const call = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error('network down')
      return 'ok'
    })
    const settled = await Promise.allSettled([
      once('magic-link:t3', call),
      once('magic-link:t3', call),
    ])
    expect(settled.map((s) => s.status)).toEqual(['rejected', 'rejected']) // 진행 중이던 둘은 같은 실패
    expect(call).toHaveBeenCalledTimes(1)
    await expect(once('magic-link:t3', call)).resolves.toBe('ok') // 일시 오류는 다시 보낼 수 있다
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('keys are per runner and per kind; a completed entry is forgotten after a minute', async () => {
    vi.useFakeTimers()
    const call = vi.fn(async () => 1)
    const a = createOnceRunner()
    const b = createOnceRunner()
    await a('magic-link:x', call)
    await b('magic-link:x', call) // 다른 라우트 한 벌은 따로
    await a('link-reauth:x', call) // 다른 종류는 따로
    expect(call).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(61_000)
    await a('magic-link:x', call)
    expect(call).toHaveBeenCalledTimes(4)
  })
})
