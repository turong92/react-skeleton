import { describe, expect, it } from 'vitest'
import { BADGE_CODE, revocableEventIds } from './badgeRows'
import type { BadgeAwardEvent } from './types'

const event = (
  id: string,
  awardId: string,
  action: BadgeAwardEvent['action'],
): BadgeAwardEvent => ({
  id,
  awardId,
  badgeId: 'b',
  badgeCode: 'c',
  badgeName: 'N',
  accountId: 'a',
  action,
  source: 'ADMIN',
  sourceRef: null,
  actorId: null,
  reason: null,
  createdAt: 't',
})

describe('revocableEventIds', () => {
  it('offers revoke only on the newest line of an award, and only when that line is an award', () => {
    // 최신순: w1 은 회수 → 다시 수여, w2 는 수여 → 회수
    const rows = [
      event('e4', 'w2', 'REVOKED'),
      event('e3', 'w1', 'AWARDED'),
      event('e2', 'w2', 'AWARDED'),
      event('e1', 'w1', 'REVOKED'),
    ]
    expect([...revocableEventIds(rows)]).toEqual(['e3'])
  })
})

describe('BADGE_CODE', () => {
  it('matches the server rule', () => {
    expect(BADGE_CODE.test('early-bird.1_x')).toBe(true)
    expect(BADGE_CODE.test('Early')).toBe(false)
    expect(BADGE_CODE.test('')).toBe(false)
    expect(BADGE_CODE.test('a'.repeat(65))).toBe(false)
  })
})
