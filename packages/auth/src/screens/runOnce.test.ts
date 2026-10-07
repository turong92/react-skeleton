import { afterEach, describe, expect, it, vi } from 'vitest'
import { runOnce } from './runOnce'

afterEach(() => vi.useRealTimers())

describe('runOnce', () => {
  it('sends one call per key and shares the settled result with every caller', async () => {
    const call = vi.fn(async () => 'ok')
    const [a, b] = await Promise.all([runOnce('t1', call), runOnce('t1', call)])
    expect([a, b]).toEqual(['ok', 'ok'])
    expect(await runOnce('t1', call)).toBe('ok') // 끝난 뒤에 와도(다시 마운트) 다시 보내지 않는다
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('shares a failure too — a spent one-time token must not be sent again', async () => {
    const call = vi.fn(async () => {
      throw new Error('gone')
    })
    await expect(runOnce('t2', call)).rejects.toThrow('gone')
    await expect(runOnce('t2', call)).rejects.toThrow('gone')
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('different keys do not share, and an entry is forgotten after a minute', async () => {
    vi.useFakeTimers()
    const call = vi.fn(async () => 1)
    await runOnce('a', call)
    await runOnce('b', call)
    expect(call).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(61_000)
    await runOnce('a', call)
    expect(call).toHaveBeenCalledTimes(3)
  })
})
