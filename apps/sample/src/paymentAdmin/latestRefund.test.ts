import { describe, expect, it } from 'vitest'
import { latestRefund } from './latestRefund'

const line = (id: string) => ({
  id,
  status: 'SUCCEEDED' as const,
  amount: { amount: 1000, currency: 'KRW' },
})

describe('latestRefund - the status line names the most recent thing that went out', () => {
  it('nothing went out: nothing', () => {
    expect(latestRefund({ refund: undefined }, { refund: undefined })).toBeUndefined()
  })

  it('one of them: that one', () => {
    expect(latestRefund({ refund: line('a'), at: 5 }, { refund: undefined })).toEqual(line('a'))
    expect(latestRefund({ refund: undefined }, { refund: line('b'), at: 5 })).toEqual(line('b'))
  })

  it('both: the later one - a direct refund and then an approval says the approval, not the old direct refund', () => {
    expect(
      latestRefund({ refund: line('direct'), at: 5 }, { refund: line('approved'), at: 9 }),
    ).toEqual(line('approved'))
    expect(
      latestRefund({ refund: line('direct'), at: 9 }, { refund: line('approved'), at: 5 }),
    ).toEqual(line('direct'))
  })
})
