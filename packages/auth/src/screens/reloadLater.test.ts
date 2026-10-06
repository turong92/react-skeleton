import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reloadLater } from './reloadLater'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('reloadLater (the backend fills me.pendingEmail off-thread, a moment after the 202)', () => {
  it('reloads at each delay', () => {
    const reload = vi.fn()
    reloadLater(reload, [1000, 3000])
    expect(reload).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(reload).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('stops once told the answer is there (done) and when cancelled', () => {
    const reload = vi.fn()
    let there = false
    const cancel = reloadLater(reload, [1000, 3000], () => there)
    vi.advanceTimersByTime(1000)
    there = true
    vi.advanceTimersByTime(5000)
    expect(reload).toHaveBeenCalledTimes(1)
    const again = vi.fn()
    reloadLater(again, [1000])()
    vi.advanceTimersByTime(2000)
    expect(again).not.toHaveBeenCalled()
    void cancel
  })
})
