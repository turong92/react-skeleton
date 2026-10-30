import { describe, expect, it } from 'vitest'
import { defaultReviewsLabels, koReviewsLabels } from './labels'
import { writeBlockedMessage } from './writeBlocked'

describe('writeBlockedMessage', () => {
  it("turns the server's reason code into the sentence the app shows where the form would be", () => {
    expect(writeBlockedMessage('PURCHASE_REQUIRED', koReviewsLabels)).toBe(
      '구매한 분만 쓸 수 있어요',
    )
    expect(writeBlockedMessage('SIGN_IN', defaultReviewsLabels)).toBe('Sign in to write a review.')
  })

  it('has a sentence for every reason the server can send', () => {
    for (const reason of ['PURCHASE_REQUIRED', 'ALREADY_WRITTEN', 'LOCKED', 'SIGN_IN'] as const)
      expect(writeBlockedMessage(reason, koReviewsLabels)!.length).toBeGreaterThan(5)
  })

  it('says nothing when nothing blocks writing', () => {
    expect(writeBlockedMessage(null, koReviewsLabels)).toBeNull()
  })
})
